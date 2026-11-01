const db = require('./db');
const { calculateHaversineDistance, calculateHeading, getDrivingRoute } = require('./services/routing');
const { calculateFare, getCurrencyForLocation } = require('./services/pricing');
const { sendRideAcceptedNotification } = require('./services/telegram');
const ivrService = require('./services/ivrService');

const OPEN_RIDE_STATUSES = ['REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'];
const DISPATCH_WINDOW_MS = 15000;
const MAX_TIP = 500;
const MAX_CHAT_LENGTH = 500;
const MAX_SIMULATION_STEPS = 40;
const PROMO_CODES = { SAVE20: 20 };

// rideId -> { candidates: driverId[], index, currentDriverId, timer }: drivers are offered a ride one at a time.
const dispatchSessions = new Map();

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

  // Keypad (IVR) answers go through the same accept/decline rules as the app.
  ivrService.setHandlers({
    accept: (rideId, driverId) => acceptRide(io, rideId, driverId),
    decline: (rideId, driverId) => advanceDispatch(io, rideId, driverId)
  });

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

      // Re-deliver the open offer if this driver reconnects while it is still theirs to answer.
      if (normalizedRole === 'DRIVER') {
        const offer = [...dispatchSessions.values()].find(session => session.currentDriverId === userId);
        const pendingRide = offer && db.getRideById(offer.rideId);
        const driver = db.getDriverById(userId);
        if (pendingRide?.status === 'REQUESTED' && driver?.status === 'ONLINE' && isValidPoint(driver.location)) {
          await emitIncomingRequest(socket, pendingRide, driver);
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

    // Driver status change (ONLINE, OFFLINE), optionally carrying destination-mode preferences
    const setDriverStatus = ({ driverId, status, destinationMode } = {}) => {
      if (!['ONLINE', 'OFFLINE'].includes(status)) return;
      const driver = db.getDriverById(driverId);
      // A driver on a trip cannot go offline/online manually; the trip flow owns BUSY.
      if (!driver || driver.status === 'BUSY') return;

      if (destinationMode && typeof destinationMode === 'object') {
        db.setDriverDestination(driverId, {
          enabled: Boolean(destinationMode.enabled),
          destination: destinationMode.destination || null
        });
      }

      const updated = db.updateDriver(driverId, { status });
      if (updated) {
        io.emit('driver:status_changed', { driverId, status, destinationMode });
      }
    };
    socket.on('driver:set_status', setDriverStatus);
    socket.on('driver:status', setDriverStatus);

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

      // Notify the rider that ride is created & dispatching
      socket.emit('ride:created', newRide);
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_REQUESTED', ride: newRide });

      startDispatch(io, newRide, rider);
    }));

    // Rider cancels, either while still waiting or after a driver accepted
    // but before the trip has started.
    socket.on('ride:cancel', ({ rideId, riderId } = {}) => {
      const ride = db.getRideById(rideId);
      const cancellable = ['REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVED'];
      if (!ride || ride.riderId !== riderId || !cancellable.includes(ride.status)) return;

      endDispatch(io, rideId, { closeOffer: true });

      const updatedRide = db.updateRide(rideId, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Cancelled by rider'
      });

      // A driver was already on the way - release them back to the road.
      if (ride.driverId) {
        stopDriverSimulation(ride.driverId);
        db.updateDriver(ride.driverId, { status: 'ONLINE' });
        io.to(`user:${ride.driverId}`).emit('ride:cancelled', { ride: updatedRide });
        io.to(`user:${ride.driverId}`).emit('ride:cancelled_by_rider', {
          rideId,
          message: 'The rider has cancelled this trip.'
        });
        io.emit('driver:status_changed', { driverId: ride.driverId, status: 'ONLINE' });
      }

      io.to(`user:${ride.riderId}`).emit('ride:cancelled', { ride: updatedRide });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updatedRide });
    });

    // Driver accepts ride request
    socket.on('ride:accept', safe('ride:accept', async ({ rideId, driverId } = {}) => {
      const result = await acceptRide(io, rideId, driverId);
      if (!result.ok) {
        socket.emit('ride:error', { message: result.message });
      }
    }));

    // Driver declines the offer (or the keypad/timeout path does it): the next nearest driver is tried.
    socket.on('ride:decline', ({ rideId, driverId } = {}) => {
      advanceDispatch(io, rideId, driverId);
    });

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

    // Arrival wait timer: relay the running wait time and fee to the rider.
    socket.on('trip:wait_timer', ({ rideId, waitingSeconds, waitingFee } = {}) => {
      const ride = db.getRideById(rideId);
      if (!ride || ride.status !== 'ARRIVED') return;
      io.to(`user:${ride.riderId}`).emit('trip:wait_timer_update', {
        rideId,
        waitingSeconds: Math.max(0, Math.floor(Number(waitingSeconds) || 0)),
        waitingFee: Math.max(0, Number(waitingFee) || 0)
      });
    });

    // Driver cancels before the trip starts, with a reason.
    socket.on('ride:cancel_reason', ({ rideId, driverId, reason } = {}) => {
      const ride = db.getRideById(rideId);
      if (!ride || ride.driverId !== driverId || !['ACCEPTED', 'ARRIVED'].includes(ride.status)) return;

      const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 200) : 'Cancelled by driver';
      stopDriverSimulation(driverId);

      const updatedRide = db.updateRide(rideId, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: cleanReason,
        cancelledBy: 'DRIVER'
      });
      db.updateDriver(driverId, { status: 'ONLINE' });

      io.emit('driver:status_changed', { driverId, status: 'ONLINE' });
      io.to(`user:${driverId}`).emit('ride:cancelled', { ride: updatedRide });
      io.to(`user:${ride.riderId}`).emit('ride:cancelled', { ride: updatedRide });
      io.to(`user:${ride.riderId}`).emit('ride:error', {
        message: `Your driver cancelled the trip: ${cleanReason}`
      });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updatedRide, reason: cleanReason });
    });

    // SOS from either party on a ride: alert admins and the other party.
    socket.on('ride:sos', ({ rideId, userId, location, note } = {}) => {
      const ride = db.getRideById(rideId);
      const user = db.getUserById(userId);
      if (!user || (ride && ![ride.riderId, ride.driverId].includes(userId))) return;

      const sosAlert = {
        id: `sos-${Date.now()}`,
        rideId: ride ? rideId : null,
        userId,
        userName: user.name,
        userPhone: user.phone || 'Emergency Dispatch',
        location: isValidPoint(location) ? { lat: Number(location.lat), lng: Number(location.lng) } : null,
        note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : 'SOS Emergency Button Triggered!',
        timestamp: new Date().toISOString()
      };

      io.to('role:admin').emit('admin:sos_alert', sosAlert);
      if (ride) {
        [ride.riderId, ride.driverId]
          .filter(Boolean)
          .forEach(id => io.to(`user:${id}`).emit('ride:sos_received', sosAlert));
      }
    });

    // In-trip Rider-Driver Chat
    socket.on('chat:send', (payload = {}) => {
      const wrapped = payload.message && typeof payload.message === 'object';
      const { senderId, senderName, senderRole, text } = wrapped ? payload.message : payload;
      const { rideId } = payload;
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
      // The driver app appends its own message locally, so only echo for the flat payload shape.
      if (!wrapped) socket.emit('chat:message', message);
    });
  });

  // Background smooth cruising loop for idle online drivers
  startIdleDriversCruising(io);
}

async function emitIncomingRequest(target, ride, driver, rider = db.getUserById(ride.riderId), extra = {}) {
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
    estimatedEarnings: Number((ride.fare * (1 - (settings.platformCommissionPercent ?? 20) / 100)).toFixed(2)),
    timeoutSeconds: DISPATCH_WINDOW_MS / 1000,
    ...extra
  });
}

/**
 * Offer a new ride to the nearest online drivers one at a time (15s each).
 * With nobody online the demo fallback auto-assigns a simulated driver.
 */
function startDispatch(io, ride, rider) {
  const candidates = db.getDrivers()
    .filter(d => d.status === 'ONLINE' && isValidPoint(d.location))
    .map(d => ({ id: d.id, dist: calculateHaversineDistance(ride.pickup.lat, ride.pickup.lng, d.location.lat, d.location.lng) }))
    .sort((a, b) => a.dist - b.dist)
    .map(c => c.id);

  if (candidates.length === 0) {
    setTimeout(() => {
      simulateAutoDriverAcceptance(io, ride.id).catch(err =>
        console.error('Auto driver acceptance failed:', err)
      );
    }, 3000);
    return;
  }

  dispatchSessions.set(ride.id, { rideId: ride.id, candidates, index: 0, currentDriverId: null, timer: null });
  offerToNextDriver(io, ride.id, rider).catch(err => console.error('Dispatch failed:', err));
}

async function offerToNextDriver(io, rideId, rider) {
  const session = dispatchSessions.get(rideId);
  if (!session) return;

  const ride = db.getRideById(rideId);
  if (!ride || ride.status !== 'REQUESTED' || ride.driverId) {
    endDispatch(io, rideId);
    return;
  }

  // Skip anyone who went offline or got busy since the list was built.
  let driver = null;
  while (session.index < session.candidates.length) {
    const candidate = db.getDriverById(session.candidates[session.index]);
    if (candidate?.status === 'ONLINE' && isValidPoint(candidate.location)) {
      driver = candidate;
      break;
    }
    session.index++;
  }

  if (!driver) {
    // Everyone declined or timed out.
    endDispatch(io, rideId);
    expireUnacceptedRide(io, rideId);
    return;
  }

  const riderUser = rider || db.getUserById(ride.riderId);
  session.currentDriverId = driver.id;

  // Arm the acceptance window first so a slow route lookup cannot extend it.
  clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    io.to(`user:${driver.id}`).emit('ride:request_timeout', { rideId });
    advanceDispatch(io, rideId, driver.id);
  }, DISPATCH_WINDOW_MS);

  await emitIncomingRequest(io.to(`user:${driver.id}`), ride, driver, riderUser);

  // Keypad-phone drivers get an automated call for the same offer.
  try {
    ivrService.initiateKeypadDispatch({
      driverPhone: driver.phone,
      driverId: driver.id,
      ride: {
        id: ride.id,
        pickup: ride.pickup?.address,
        destination: ride.destination?.address,
        fare: ride.fare,
        riderName: riderUser?.name
      }
    });
  } catch (err) {
    console.warn('IVR dispatch notice failed:', err.message);
  }

  io.to(`user:${ride.riderId}`).emit('ride:dispatch_status', {
    status: 'SEARCHING',
    attempt: session.index + 1,
    totalAttempts: session.candidates.length
  });
}

/** Current driver declined or ran out of time: try the next one. */
function advanceDispatch(io, rideId, driverId) {
  const session = dispatchSessions.get(rideId);
  if (!session || session.currentDriverId !== driverId) return;

  clearTimeout(session.timer);
  session.timer = null;
  io.to(`user:${driverId}`).emit('ride:request_closed', { rideId });

  session.index++;
  session.currentDriverId = null;
  offerToNextDriver(io, rideId).catch(err => console.error('Dispatch failed:', err));
}

function endDispatch(io, rideId, { closeOffer = false } = {}) {
  const session = dispatchSessions.get(rideId);
  if (!session) return;
  clearTimeout(session.timer);
  if (closeOffer && session.currentDriverId) {
    io.to(`user:${session.currentDriverId}`).emit('ride:request_cancelled', { rideId });
  }
  dispatchSessions.delete(rideId);
}

/**
 * Assign a requested ride to a driver. Shared by the app and keypad (IVR) paths.
 * Returns { ok: true } or { ok: false, message }.
 */
async function acceptRide(io, rideId, driverId) {
  const unavailable = { ok: false, message: 'This ride request is no longer available.' };
  const ride = db.getRideById(rideId);
  const driver = db.getDriverById(driverId);
  if (!ride || !driver) return unavailable;

  const session = dispatchSessions.get(rideId);
  const notOffered = session && session.currentDriverId !== driverId;
  if (ride.status !== 'REQUESTED' || ride.driverId || driver.status === 'BUSY' || notOffered) return unavailable;

  // Claim the ride before awaiting anything so two drivers cannot both accept it.
  db.updateRide(rideId, { driverId });
  db.updateDriver(driverId, { status: 'BUSY' });
  endDispatch(io, rideId);

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
    return unavailable;
  }

  const updatedRide = db.updateRide(rideId, {
    driverId,
    status: 'ACCEPTED',
    acceptedAt: new Date().toISOString(),
    driverRouteCoordinates: toPickupRoute.coordinates,
    etaToPickupMin: toPickupRoute.durationMin
  });

  const rider = db.getUserById(ride.riderId);

  sendRideAcceptedNotification(updatedRide, driver, rider);

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

  io.to(`user:${driverId}`).emit('ride:accepted_confirmation', {
    ride: updatedRide,
    rider: db.sanitizeUser(rider),
    routeToPickup: toPickupRoute
  });

  io.emit('driver:status_changed', { driverId, status: 'BUSY' });
  io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_ACCEPTED', ride: updatedRide, driver: db.sanitizeUser(driver) });

  // Start automatic simulated smooth GPS progression to pickup
  startDriverMovementSimulation(io, driverId, toPickupRoute.coordinates, 'TO_PICKUP', rideId);
  return { ok: true };
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

  const rider = db.getUserById(ride.riderId);

  sendRideAcceptedNotification(updatedRide, availableDriver, rider);

  io.to(`user:${ride.riderId}`).emit('ride:accepted', {
    ride: updatedRide,
    driver: availableDriver,
    etaToPickupMin: toPickupRoute.durationMin
  });

  io.to(`user:${availableDriver.id}`).emit('ride:accepted_confirmation', {
    ride: updatedRide,
    rider: db.sanitizeUser(rider),
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
