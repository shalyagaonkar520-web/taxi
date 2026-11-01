const db = require('./db');
const { calculateHaversineDistance, calculateHeading, getDrivingRoute } = require('./services/routing');
const { calculateFare, getCurrencyForLocation } = require('./services/pricing');

const OPEN_RIDE_STATUSES = ['REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'];
const REQUEST_EXPIRY_MS = 45000;
const MAX_TIP = 500;
const MAX_CHAT_LENGTH = 500;
const MAX_SIMULATION_STEPS = 40;
const PROMO_CODES = { SAVE20: 20 };

// driverId -> interval handle, so a driver only ever has one movement simulation running.
const driverSimulations = new Map();

const isValidPoint = (point) =>
  point &&
  Number.isFinite(Number(point.lat)) &&
  Number.isFinite(Number(point.lng)) &&
  Math.abs(Number(point.lat)) <= 90 &&
  Math.abs(Number(point.lng)) <= 180;

const isStopped = (ride) => !ride || ['CANCELLED', 'COMPLETED'].includes(ride.status);

function setupSocketIO(io) {
  // Rides cannot survive a restart because their driver simulations die with the process.
  // Close them out so riders and drivers are not stuck on a ride that will never progress.
  db.getRides()
    .filter(ride => OPEN_RIDE_STATUSES.includes(ride.status))
    .forEach(ride => {
      db.updateRide(ride.id, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Interrupted by a server restart'
      });
    });
  db.getDrivers()
    .filter(driver => driver.status === 'BUSY')
    .forEach(driver => db.updateDriver(driver.id, { status: 'ONLINE' }));

  io.on('connection', (socket) => {
    // Async handlers must never reject: an unhandled rejection would take the whole server down.
    const safe = (name, handler) => async (...args) => {
      try {
        await handler(...args);
      } catch (err) {
        console.error(`Socket handler "${name}" failed:`, err);
        socket.emit('ride:error', { message: 'Something went wrong. Please try again.' });
      }
    };

    // Join with user identity
    socket.on('user:register', safe('user:register', async ({ userId, role } = {}) => {
      if (typeof userId !== 'string' || !userId) return;
      const normalizedRole = typeof role === 'string' ? role.toUpperCase() : null;

      socket.join(`user:${userId}`);
      if (normalizedRole) {
        socket.join(`role:${normalizedRole.toLowerCase()}`);
      }

      // Send initial state snapshot
      socket.emit('init:state', {
        drivers: db.getDrivers(),
        activeRide: db.getActiveRideForUser(userId),
        settings: db.getSettings()
      });

      // Re-deliver pending requests when a driver connects after dispatch.
      if (normalizedRole === 'DRIVER') {
        const pendingRide = db.getRides().find(ride => ride.status === 'REQUESTED' && !ride.driverId);
        const driver = db.getDriverById(userId);
        if (pendingRide && driver?.status === 'ONLINE' && isValidPoint(driver.location)) {
          emitIncomingRequest(socket, pendingRide, driver);
        }
      }
    }));

    // Driver location update from device GPS
    socket.on('driver:location_update', ({ driverId, location } = {}) => {
      const driver = db.getDriverById(driverId);
      if (!driver || !isValidPoint(location)) return;

      const lat = Number(location.lat);
      const lng = Number(location.lng);
      const prevLoc = isValidPoint(driver.location) ? driver.location : { lat, lng };
      const heading = calculateHeading(prevLoc.lat, prevLoc.lng, lat, lng) || driver.location?.heading || 0;

      const updated = db.updateDriver(driverId, { location: { lat, lng, heading } }, { persist: false });

      // Broadcast to riders and admin
      io.emit('driver:moved', {
        driverId,
        location: updated.location,
        status: updated.status,
        vehicle: updated.vehicle
      });
    });

    // Driver status change (ONLINE, OFFLINE)
    socket.on('driver:set_status', ({ driverId, status } = {}) => {
      if (!['ONLINE', 'OFFLINE'].includes(status)) return;
      const driver = db.getDriverById(driverId);
      // A driver on a trip cannot go offline/online manually; the trip flow owns BUSY.
      if (!driver || driver.status === 'BUSY') return;

      const updated = db.updateDriver(driverId, { status });
      if (updated) {
        io.emit('driver:status_changed', { driverId, status });
      }
    });

    // Rider requests a ride
    socket.on('ride:request', safe('ride:request', async (requestData) => {
      const { riderId, pickup, destination, category, paymentMethod = 'WALLET', promoCode } = requestData || {};
      const rider = db.getUserById(riderId);

      if (!rider || !isValidPoint(pickup) || !isValidPoint(destination)) {
        socket.emit('ride:error', { message: 'A valid pickup and destination are required.' });
        return;
      }

      if (db.getActiveRideForUser(riderId)) {
        socket.emit('ride:error', { message: 'You already have a ride in progress.' });
        return;
      }

      const settings = db.getSettings();

      // Calculate route
      const routeInfo = await getDrivingRoute(pickup, destination);
      const fareInfo = calculateFare({
        category,
        distanceKm: routeInfo.distanceKm,
        durationMin: routeInfo.durationMin,
        surgeMultiplier: settings.surgeMultiplier,
        currencyInfo: getCurrencyForLocation(settings.city, settings.currencyCode)
      });

      // The quote shown to the rider includes the promo discount, so charge the same amount.
      const discountPercent = PROMO_CODES[String(promoCode || '').toUpperCase()] || 0;
      const fare = Number((fareInfo.totalFare * (1 - discountPercent / 100)).toFixed(2));

      if (paymentMethod === 'WALLET' && (rider.walletBalance || 0) < fare) {
        socket.emit('ride:error', {
          message: 'Your wallet balance is too low for this ride. Please top up your wallet and try again.'
        });
        return;
      }

      // Create new ride record
      const newRide = db.createRide({
        riderId,
        pickup,
        destination,
        category: fareInfo.category,
        fare,
        ...(discountPercent ? { promoCode: String(promoCode).toUpperCase(), discountPercent } : {}),
        distanceKm: routeInfo.distanceKm,
        durationMin: routeInfo.durationMin,
        paymentMethod,
        routeCoordinates: routeInfo.coordinates,
        status: 'REQUESTED'
      });

      // Find the nearest online driver
      const drivers = db.getDrivers().filter(d => d.status === 'ONLINE' && isValidPoint(d.location));
      let targetDriver = null;

      if (drivers.length > 0) {
        targetDriver = drivers
          .map(d => ({
            driver: d,
            dist: calculateHaversineDistance(pickup.lat, pickup.lng, d.location.lat, d.location.lng)
          }))
          .sort((a, b) => a.dist - b.dist)[0].driver;
      }

      // Notify the rider that ride is created & dispatching
      socket.emit('ride:created', newRide);
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_REQUESTED', ride: newRide });

      if (targetDriver) {
        await emitIncomingRequest(io.to(`user:${targetDriver.id}`), newRide, targetDriver, rider);

        // Nobody picked the request up: release the rider instead of leaving them waiting forever.
        setTimeout(() => expireUnacceptedRide(io, newRide.id), REQUEST_EXPIRY_MS);
      } else {
        // Fallback: If no manual driver online, auto-simulate driver acceptance in 3 seconds
        setTimeout(() => {
          simulateAutoDriverAcceptance(io, newRide.id).catch(err =>
            console.error('Auto driver acceptance failed:', err)
          );
        }, 3000);
      }
    }));

    // Rider cancels a request before a driver accepts it.
    socket.on('ride:cancel', ({ rideId, riderId } = {}) => {
      const ride = db.getRideById(rideId);
      if (!ride || ride.riderId !== riderId || !['REQUESTED', 'MATCHING'].includes(ride.status)) return;

      const updatedRide = db.updateRide(rideId, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Cancelled by rider'
      });

      io.to(`user:${ride.riderId}`).emit('ride:cancelled', { ride: updatedRide });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updatedRide });
    });

    // Driver accepts ride request
    socket.on('ride:accept', safe('ride:accept', async ({ rideId, driverId } = {}) => {
      const ride = db.getRideById(rideId);
      const driver = db.getDriverById(driverId);
      if (!ride || !driver) return;

      if (ride.status !== 'REQUESTED' || ride.driverId || driver.status === 'BUSY') {
        socket.emit('ride:error', { message: 'This ride request is no longer available.' });
        return;
      }

      // Claim the ride before awaiting anything so two drivers cannot both accept it.
      db.updateRide(rideId, { driverId });
      db.updateDriver(driverId, { status: 'BUSY' });

      let toPickupRoute;
      try {
        toPickupRoute = await getDrivingRoute(driver.location, ride.pickup);
      } catch (err) {
        db.updateRide(rideId, { driverId: null });
        db.updateDriver(driverId, { status: 'ONLINE' });
        throw err;
      }

      // The rider may have cancelled while the route was being calculated.
      if (db.getRideById(rideId)?.status !== 'REQUESTED') {
        db.updateDriver(driverId, { status: 'ONLINE' });
        socket.emit('ride:error', { message: 'This ride request is no longer available.' });
        return;
      }

      const updatedRide = db.updateRide(rideId, {
        driverId,
        status: 'ACCEPTED',
        acceptedAt: new Date().toISOString(),
        driverRouteCoordinates: toPickupRoute.coordinates,
        etaToPickupMin: toPickupRoute.durationMin
      });

      const rider = db.getUserById(ride.riderId);

      // Broadcast to Rider & Driver & Admin
      io.to(`user:${ride.riderId}`).emit('ride:accepted', {
        ride: updatedRide,
        driver: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          rating: driver.rating,
          totalTrips: driver.totalTrips,
          avatar: driver.avatar,
          location: driver.location,
          vehicle: driver.vehicle
        },
        etaToPickupMin: toPickupRoute.durationMin
      });

      socket.emit('ride:accepted_confirmation', {
        ride: updatedRide,
        rider: db.sanitizeUser(rider),
        routeToPickup: toPickupRoute
      });

      io.emit('driver:status_changed', { driverId, status: 'BUSY' });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_ACCEPTED', ride: updatedRide, driver: db.sanitizeUser(driver) });

      // Start automatic simulated smooth GPS progression to pickup
      startDriverMovementSimulation(io, driverId, toPickupRoute.coordinates, 'TO_PICKUP', rideId);
    }));

    // Driver arrives at pickup location
    socket.on('ride:arrived', ({ rideId, driverId } = {}) => {
      const ride = db.getRideById(rideId);
      if (!ride || ride.driverId !== driverId || !['ACCEPTED', 'ARRIVED'].includes(ride.status)) return;

      // The pickup simulation may already have marked the driver as arrived; stay idempotent.
      const updatedRide = ride.status === 'ARRIVED'
        ? ride
        : db.updateRide(rideId, { status: 'ARRIVED', arrivedAt: new Date().toISOString() });

      if (ride.status === 'ACCEPTED') {
        stopDriverSimulation(driverId);
        io.to(`user:${ride.riderId}`).emit('ride:driver_arrived', {
          ride: updatedRide,
          message: 'Your driver has arrived! Meet them at the pickup point.'
        });
        io.to('role:admin').emit('admin:ride_event', { type: 'DRIVER_ARRIVED', ride: updatedRide });
      }

      socket.emit('ride:arrival_confirmed', { ride: updatedRide });
    });

    // Driver verifies OTP and starts the ride
    socket.on('ride:start', safe('ride:start', async ({ rideId, driverId, otp } = {}) => {
      const ride = db.getRideById(rideId);
      if (!ride || ride.driverId !== driverId || ride.status !== 'ARRIVED') return;

      if (ride.otp && String(otp ?? '').trim() !== String(ride.otp).trim()) {
        socket.emit('ride:error', { message: 'Invalid 4-digit security PIN. Please ask the rider.' });
        return;
      }

      // Calculate fresh route to destination
      const toDestinationRoute = await getDrivingRoute(ride.pickup, ride.destination);

      const updatedRide = db.updateRide(rideId, {
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
        tripRouteCoordinates: toDestinationRoute.coordinates
      });

      io.to(`user:${ride.riderId}`).emit('ride:started', {
        ride: updatedRide,
        route: toDestinationRoute
      });

      socket.emit('ride:started_confirmation', {
        ride: updatedRide,
        route: toDestinationRoute
      });

      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_STARTED', ride: updatedRide });

      // Start smooth movement along destination route
      startDriverMovementSimulation(io, driverId, toDestinationRoute.coordinates, 'TO_DESTINATION', rideId);
    }));

    // Driver completes the trip
    socket.on('ride:complete', ({ rideId, driverId } = {}) => {
      completeRideWorkflow(io, rideId, driverId);
    });

    // Rider submits rating & tip
    socket.on('ride:rate_and_tip', ({ rideId, riderId, rating, tip = 0, feedback } = {}) => {
      const ride = db.getRideById(rideId);
      if (!ride || ride.riderId !== riderId || ride.status !== 'COMPLETED' || ride.ratedAt) return;

      const safeRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
      let safeTip = Number(tip);
      safeTip = Number.isFinite(safeTip) && safeTip > 0 ? Math.min(MAX_TIP, Number(safeTip.toFixed(2))) : 0;

      const driver = ride.driverId ? db.getDriverById(ride.driverId) : null;
      const rider = db.getUserById(riderId);

      // Only charge a tip the rider can actually cover.
      if (safeTip > 0 && (!driver || !rider || (rider.walletBalance || 0) < safeTip)) {
        safeTip = 0;
      }

      const updatedRide = db.updateRide(rideId, {
        rating: safeRating,
        tip: safeTip,
        feedback: typeof feedback === 'string' ? feedback.slice(0, 500) : '',
        ratedAt: new Date().toISOString()
      });

      if (safeTip > 0) {
        db.updateUser(riderId, { walletBalance: Number(((rider.walletBalance || 0) - safeTip).toFixed(2)) });
        db.updateDriver(ride.driverId, {
          walletBalance: Number(((driver.walletBalance || 0) + safeTip).toFixed(2)),
          earningsToday: Number(((driver.earningsToday || 0) + safeTip).toFixed(2))
        });

        db.addTransaction({
          userId: riderId,
          amount: -safeTip,
          type: 'TIP',
          description: `Driver Tip for trip to ${ride.destination.address.split(',')[0]}`
        });

        db.addTransaction({
          userId: ride.driverId,
          amount: safeTip,
          type: 'TIP',
          description: `Received Tip from ${rider.name}`
        });
      }

      socket.emit('ride:rated_confirmation', { ride: updatedRide });
      if (ride.driverId) {
        io.to(`user:${ride.driverId}`).emit('driver:received_review', {
          rating: safeRating,
          tip: safeTip,
          feedback: updatedRide.feedback
        });
      }
    });

    // In-trip Rider-Driver Chat
    socket.on('chat:send', ({ rideId, senderId, senderName, senderRole, text } = {}) => {
      const ride = db.getRideById(rideId);
      if (!ride || ![ride.riderId, ride.driverId].includes(senderId)) return;

      const body = typeof text === 'string' ? text.trim().slice(0, MAX_CHAT_LENGTH) : '';
      if (!body) return;

      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rideId,
        senderId,
        senderName: typeof senderName === 'string' ? senderName.slice(0, 80) : '',
        senderRole,
        text: body,
        timestamp: new Date().toISOString()
      };

      const recipientId = senderId === ride.riderId ? ride.driverId : ride.riderId;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('chat:message', message);
      }
      socket.emit('chat:message', message);
    });
  });

  // Background smooth cruising loop for idle online drivers
  startIdleDriversCruising(io);
}

async function emitIncomingRequest(target, ride, driver, rider = db.getUserById(ride.riderId)) {
  const settings = db.getSettings();
  let toPickupRoute = { distanceKm: 0, durationMin: 0 };
  try {
    toPickupRoute = await getDrivingRoute(driver.location, ride.pickup);
  } catch (err) {
    console.warn('Could not route driver to pickup for request preview:', err.message);
  }

  target.emit('ride:incoming_request', {
    ride,
    rider: {
      name: rider?.name || 'Passenger',
      rating: rider?.rating || 4.9,
      avatar: rider?.avatar
    },
    pickupDistanceKm: toPickupRoute.distanceKm,
    pickupDurationMin: toPickupRoute.durationMin,
    estimatedEarnings: Number((ride.fare * (1 - (settings.platformCommissionPercent ?? 20) / 100)).toFixed(2))
  });
}

function stopDriverSimulation(driverId) {
  const timer = driverSimulations.get(driverId);
  if (timer) {
    clearInterval(timer);
    driverSimulations.delete(driverId);
  }
}

/**
 * Cancel a request that no driver accepted within the acceptance window.
 */
function expireUnacceptedRide(io, rideId) {
  const ride = db.getRideById(rideId);
  if (!ride || ride.status !== 'REQUESTED' || ride.driverId) return;

  const updatedRide = db.updateRide(rideId, {
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
    cancellationReason: 'No driver accepted the request'
  });

  io.to(`user:${ride.riderId}`).emit('ride:cancelled', { ride: updatedRide });
  io.to(`user:${ride.riderId}`).emit('ride:error', {
    message: 'No driver accepted your request. Please try again.'
  });
  io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updatedRide });
}

/**
 * Handle Complete Ride Settlement
 */
function completeRideWorkflow(io, rideId, driverId) {
  const ride = db.getRideById(rideId);
  const driver = db.getDriverById(driverId);
  const settings = db.getSettings();
  // Settle exactly once, and only for the assigned driver on a trip that is actually running.
  if (!ride || !driver || ride.driverId !== driverId || ride.status !== 'IN_PROGRESS') return;

  stopDriverSimulation(driverId);

  const commissionRate = (settings.platformCommissionPercent ?? 20) / 100;
  const platformCut = Number((ride.fare * commissionRate).toFixed(2));
  const driverEarnings = Number((ride.fare - platformCut).toFixed(2));
  const symbol = settings.currencySymbol || '$';

  // Update statuses
  db.updateDriver(driverId, {
    status: 'ONLINE',
    earningsToday: Number(((driver.earningsToday || 0) + driverEarnings).toFixed(2)),
    walletBalance: Number(((driver.walletBalance || 0) + driverEarnings).toFixed(2)),
    totalTrips: (driver.totalTrips || 0) + 1
  });

  const updatedRide = db.updateRide(rideId, {
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    driverEarnings,
    platformFee: platformCut
  });

  // Rider wallet deduction if wallet payment
  const rider = db.getUserById(ride.riderId);
  if (rider) {
    const riderUpdates = { totalRides: (rider.totalRides || 0) + 1 };
    if (ride.paymentMethod === 'WALLET') {
      riderUpdates.walletBalance = Number(((rider.walletBalance || 0) - ride.fare).toFixed(2));
    }
    db.updateUser(ride.riderId, riderUpdates);

    if (ride.paymentMethod === 'WALLET') {
      db.addTransaction({
        userId: ride.riderId,
        amount: -ride.fare,
        type: 'RIDE_PAYMENT',
        description: `Ride to ${ride.destination.address.split(',')[0]}`
      });
    }
  }

  // Driver transaction
  db.addTransaction({
    userId: driverId,
    amount: driverEarnings,
    type: 'DRIVER_PAYOUT',
    description: `Trip Earnings (Fare ${symbol}${ride.fare} - Platform Fee ${symbol}${platformCut})`
  });

  // Notify Rider
  io.to(`user:${ride.riderId}`).emit('ride:completed', {
    ride: updatedRide,
    receipt: {
      fare: ride.fare,
      distanceKm: ride.distanceKm,
      durationMin: ride.durationMin,
      paymentMethod: ride.paymentMethod,
      completedAt: updatedRide.completedAt
    }
  });

  // Notify Driver
  io.to(`user:${driverId}`).emit('ride:completed_confirmation', {
    ride: updatedRide,
    earnings: driverEarnings,
    totalToday: Number(((driver.earningsToday || 0) + driverEarnings).toFixed(2))
  });

  io.emit('driver:status_changed', { driverId, status: 'ONLINE' });
  io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_COMPLETED', ride: updatedRide });
}

/**
 * Auto-acceptance for testing / demo
 */
async function simulateAutoDriverAcceptance(io, rideId) {
  const ride = db.getRideById(rideId);
  if (!ride || ride.status !== 'REQUESTED' || ride.driverId) return;

  const drivers = db.getDrivers().filter(d => isValidPoint(d.location));
  const availableDriver = drivers.find(d => d.status === 'ONLINE');
  if (!availableDriver) {
    // Nobody is available: release the rider rather than leaving the request hanging.
    expireUnacceptedRide(io, rideId);
    return;
  }

  // Claim before awaiting so a concurrent manual accept cannot double-assign.
  db.updateRide(rideId, { driverId: availableDriver.id });
  db.updateDriver(availableDriver.id, { status: 'BUSY' });

  let toPickupRoute;
  try {
    toPickupRoute = await getDrivingRoute(availableDriver.location, ride.pickup);
  } catch (err) {
    db.updateRide(rideId, { driverId: null });
    db.updateDriver(availableDriver.id, { status: 'ONLINE' });
    throw err;
  }

  if (db.getRideById(rideId)?.status !== 'REQUESTED') {
    db.updateDriver(availableDriver.id, { status: 'ONLINE' });
    return;
  }

  const updatedRide = db.updateRide(rideId, {
    driverId: availableDriver.id,
    status: 'ACCEPTED',
    acceptedAt: new Date().toISOString(),
    driverRouteCoordinates: toPickupRoute.coordinates,
    etaToPickupMin: toPickupRoute.durationMin
  });

  io.to(`user:${ride.riderId}`).emit('ride:accepted', {
    ride: updatedRide,
    driver: availableDriver,
    etaToPickupMin: toPickupRoute.durationMin
  });

  io.to(`user:${availableDriver.id}`).emit('ride:accepted_confirmation', {
    ride: updatedRide,
    rider: db.sanitizeUser(db.getUserById(ride.riderId)),
    routeToPickup: toPickupRoute
  });

  io.emit('driver:status_changed', { driverId: availableDriver.id, status: 'BUSY' });
  io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_ACCEPTED', ride: updatedRide, driver: availableDriver });

  // Move driver towards pickup
  startDriverMovementSimulation(io, availableDriver.id, toPickupRoute.coordinates, 'TO_PICKUP', rideId);
}

/**
 * Smooth simulated driver vehicle animation along GPS route
 */
function startDriverMovementSimulation(io, driverId, coordinates, phase, rideId) {
  if (!coordinates || coordinates.length === 0) return;

  // Only one simulation per driver; a new phase replaces the previous one.
  stopDriverSimulation(driverId);

  // Real routes can have thousands of points; keep the animation to a bounded number of steps.
  if (coordinates.length > MAX_SIMULATION_STEPS) {
    const stride = (coordinates.length - 1) / (MAX_SIMULATION_STEPS - 1);
    coordinates = Array.from({ length: MAX_SIMULATION_STEPS }, (_, i) => coordinates[Math.round(i * stride)]);
  }

  let index = 0;
  const totalSteps = coordinates.length;
  // Interval speed: calculate step time to make trip preview realistic & engaging (10-15 seconds total)
  const stepDelay = Math.max(400, Math.min(1200, Math.floor(12000 / totalSteps)));

  const timer = setInterval(() => {
    // Stop if the ride was cancelled/completed underneath the simulation.
    if (isStopped(db.getRideById(rideId))) {
      stopDriverSimulation(driverId);
      return;
    }

    index++;
    if (index >= totalSteps) {
      stopDriverSimulation(driverId);
      const finalCoord = coordinates[totalSteps - 1];
      const previous = db.getDriverById(driverId)?.location;
      db.updateDriver(driverId, {
        location: { lat: finalCoord[0], lng: finalCoord[1], heading: previous?.heading || 0 }
      });

      if (phase === 'TO_PICKUP') {
        // Driver arrives
        const ride = db.getRideById(rideId);
        if (ride && ride.status === 'ACCEPTED') {
          const updatedRide = db.updateRide(rideId, { status: 'ARRIVED', arrivedAt: new Date().toISOString() });
          io.to(`user:${ride.riderId}`).emit('ride:driver_arrived', {
            ride: updatedRide,
            message: 'Your driver has arrived!'
          });
          io.to(`user:${driverId}`).emit('ride:arrival_confirmed', { ride: updatedRide });
          io.to('role:admin').emit('admin:ride_event', { type: 'DRIVER_ARRIVED', ride: updatedRide });
        }
      } else if (phase === 'TO_DESTINATION') {
        // Trip completes
        completeRideWorkflow(io, rideId, driverId);
      }
      return;
    }

    const currentCoord = coordinates[index];
    const prevCoord = coordinates[index - 1] || currentCoord;
    const heading = calculateHeading(prevCoord[0], prevCoord[1], currentCoord[0], currentCoord[1]);

    const updated = db.updateDriver(driverId, {
      location: {
        lat: currentCoord[0],
        lng: currentCoord[1],
        heading
      }
    }, { persist: false });
    if (!updated) {
      stopDriverSimulation(driverId);
      return;
    }

    const ride = db.getRideById(rideId);
    const remainingSteps = totalSteps - index;
    const remainingKm = Number(((remainingSteps / totalSteps) * (phase === 'TO_DESTINATION' ? ride?.distanceKm || 2.5 : 2.5)).toFixed(2));
    const remainingMin = Math.max(1, Math.ceil(remainingSteps * (stepDelay / 1000) / 4));

    io.emit('driver:moved', {
      driverId,
      location: updated.location,
      status: updated.status,
      heading,
      remainingKm,
      remainingMin
    });
  }, stepDelay);

  driverSimulations.set(driverId, timer);
}

/**
 * Keep idle online drivers gently moving in the city
 */
function startIdleDriversCruising(io) {
  setInterval(() => {
    const drivers = db.getDrivers().filter(d => d.status === 'ONLINE' && isValidPoint(d.location));
    drivers.forEach(d => {
      // Small random drift simulating cruising (approx 20-30 meters)
      const dLat = (Math.random() - 0.5) * 0.0004;
      const dLng = (Math.random() - 0.5) * 0.0004;
      const newLat = d.location.lat + dLat;
      const newLng = d.location.lng + dLng;
      const heading = calculateHeading(d.location.lat, d.location.lng, newLat, newLng);

      // Cosmetic movement: keep it in memory instead of rewriting storage every few seconds.
      const updated = db.updateDriver(d.id, {
        location: { lat: newLat, lng: newLng, heading }
      }, { persist: false });

      if (updated && updated.location) {
        io.emit('driver:moved', {
          driverId: d.id,
          location: updated.location,
          status: updated.status,
          heading
        });
      }
    });
  }, 4000);
}

module.exports = {
  setupSocketIO
};
