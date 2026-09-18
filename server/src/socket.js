const db = require('./db');
const { calculateHaversineDistance, calculateHeading, getDrivingRoute } = require('./services/routing');
const { calculateFare } = require('./services/pricing');

function setupSocketIO(io) {
  // Connected socket mappings: userId -> socketId
  const userSockets = new Map();
  // Simulated trip timers for smooth automated navigation when needed
  const activeSimulations = new Map();

  // Do not restore abandoned dispatch requests after a server restart.
  db.getRides()
    .filter(ride => ride.status === 'REQUESTED')
    .filter(ride => Date.now() - new Date(ride.createdAt).getTime() > 30000)
    .forEach(ride => db.updateRide(ride.id, {
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      cancellationReason: 'Dispatch request expired'
    }));

  io.on('connection', (socket) => {
    let currentUserId = null;
    let currentUserRole = null;

    // Join with user identity
    socket.on('user:register', async ({ userId, role }) => {
      currentUserId = userId;
      currentUserRole = role;
      userSockets.set(userId, socket.id);
      socket.join(`user:${userId}`);
      if (role) {
        socket.join(`role:${role.toLowerCase()}`);
      }

      // Send initial state snapshot
      socket.emit('init:state', {
        drivers: db.getDrivers(),
        activeRide: db.getActiveRideForUser(userId),
        settings: db.getSettings()
      });

      // Re-deliver pending requests when a driver connects after dispatch.
      if (role === 'DRIVER') {
        const pendingRide = db.getRides().find(ride => ride.status === 'REQUESTED' && !ride.driverId);
        const driver = db.getDriverById(userId);
        if (pendingRide && driver?.status === 'ONLINE') {
          const rider = db.getUserById(pendingRide.riderId);
          const toPickupRoute = await getDrivingRoute(driver.location, pendingRide.pickup);
          const settings = db.getSettings();
          socket.emit('ride:incoming_request', {
            ride: pendingRide,
            rider: {
              name: rider?.name || 'Passenger',
              rating: rider?.rating || 4.9,
              avatar: rider?.avatar
            },
            pickupDistanceKm: toPickupRoute.distanceKm,
            pickupDurationMin: toPickupRoute.durationMin,
            estimatedEarnings: Number((pendingRide.fare * (1 - settings.platformCommissionPercent / 100)).toFixed(2))
          });
        }
      }
    });

    // Driver location update from device GPS
    socket.on('driver:location_update', ({ driverId, location }) => {
      const driver = db.getDriverById(driverId);
      if (driver && location && location.lat && location.lng) {
        const prevLoc = driver.location || location;
        const heading = calculateHeading(prevLoc.lat, prevLoc.lng, location.lat, location.lng) || driver.location?.heading || 0;
        
        const updated = db.updateDriver(driverId, {
          location: {
            lat: location.lat,
            lng: location.lng,
            heading
          }
        });

        // Broadcast to riders and admin
        io.emit('driver:moved', {
          driverId,
          location: updated.location,
          status: updated.status,
          vehicle: updated.vehicle
        });
      }
    });

    // Driver status change (ONLINE, OFFLINE)
    socket.on('driver:set_status', ({ driverId, status }) => {
      const updated = db.updateDriver(driverId, { status });
      if (updated) {
        io.emit('driver:status_changed', { driverId, status });
      }
    });

    // Rider requests a ride
    socket.on('ride:request', async (requestData) => {
      const { riderId, pickup, destination, category, paymentMethod = 'WALLET' } = requestData;
      const settings = db.getSettings();

      // Calculate route
      const routeInfo = await getDrivingRoute(pickup, destination);
      const fareInfo = calculateFare({
        category,
        distanceKm: routeInfo.distanceKm,
        durationMin: routeInfo.durationMin,
        surgeMultiplier: settings.surgeMultiplier
      });

      // Create new ride record
      const newRide = db.createRide({
        riderId,
        pickup,
        destination,
        category,
        fare: fareInfo.totalFare,
        distanceKm: routeInfo.distanceKm,
        durationMin: routeInfo.durationMin,
        paymentMethod,
        routeCoordinates: routeInfo.coordinates,
        status: 'REQUESTED'
      });

      const rider = db.getUserById(riderId);

      // Find nearby online drivers (matching category if possible)
      const drivers = db.getDrivers().filter(d => d.status === 'ONLINE');
      let targetDriver = null;

      if (drivers.length > 0) {
        // Sort by distance to pickup
        const sorted = drivers.map(d => ({
          driver: d,
          dist: calculateHaversineDistance(pickup.lat, pickup.lng, d.location.lat, d.location.lng)
        })).sort((a, b) => a.dist - b.dist);

        targetDriver = sorted[0].driver;
      }

      // Notify the rider that ride is created & dispatching
      socket.emit('ride:created', newRide);
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_REQUESTED', ride: newRide });

      if (targetDriver) {
        // Calculate driver to pickup route for preview
        const toPickupRoute = await getDrivingRoute(targetDriver.location, pickup);
        
        // Notify the target driver with 15s acceptance window
        io.to(`user:${targetDriver.id}`).emit('ride:incoming_request', {
          ride: newRide,
          rider: {
            name: rider?.name || 'Passenger',
            rating: rider?.rating || 4.9,
            avatar: rider?.avatar
          },
          pickupDistanceKm: toPickupRoute.distanceKm,
          pickupDurationMin: toPickupRoute.durationMin,
          estimatedEarnings: Number((newRide.fare * (1 - settings.platformCommissionPercent / 100)).toFixed(2))
        });
      } else {
        // Fallback: If no manual driver online, auto-simulate driver acceptance in 3 seconds
        setTimeout(() => {
          simulateAutoDriverAcceptance(io, newRide.id);
        }, 3000);
      }
    });

    // Rider cancels, either while still waiting or after a driver accepted
    // but before the trip has started.
    socket.on('ride:cancel', ({ rideId, riderId }) => {
      const ride = db.getRideById(rideId);
      const cancellable = ['REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVED'];
      if (!ride || ride.riderId !== riderId || !cancellable.includes(ride.status)) return;

      const updatedRide = db.updateRide(rideId, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Cancelled by rider'
      });

      // A driver was already on the way - release them back to the road.
      if (ride.driverId) {
        db.updateDriver(ride.driverId, { status: 'ONLINE' });
        io.to(`user:${ride.driverId}`).emit('ride:cancelled', { ride: updatedRide });
        io.emit('driver:status_changed', { driverId: ride.driverId, status: 'ONLINE' });
      }

      io.to(`user:${ride.riderId}`).emit('ride:cancelled', { ride: updatedRide });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updatedRide });
    });

    // Driver accepts ride request
    socket.on('ride:accept', async ({ rideId, driverId }) => {
      const ride = db.getRideById(rideId);
      const driver = db.getDriverById(driverId);
      if (!ride || !driver) return;

      // Update ride and driver statuses
      db.updateDriver(driverId, { status: 'BUSY' });
      
      const toPickupRoute = await getDrivingRoute(driver.location, ride.pickup);
      
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
        rider,
        routeToPickup: toPickupRoute
      });

      io.emit('driver:status_changed', { driverId, status: 'BUSY' });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_ACCEPTED', ride: updatedRide, driver });

      // Start automatic simulated smooth GPS progression to pickup if it's a simulated driver
      startDriverMovementSimulation(io, driverId, toPickupRoute.coordinates, 'TO_PICKUP', rideId);
    });

    // Driver arrives at pickup location
    socket.on('ride:arrived', ({ rideId, driverId }) => {
      const ride = db.getRideById(rideId);
      if (!ride) return;

      const updatedRide = db.updateRide(rideId, {
        status: 'ARRIVED',
        arrivedAt: new Date().toISOString()
      });

      io.to(`user:${ride.riderId}`).emit('ride:driver_arrived', {
        ride: updatedRide,
        message: 'Your driver has arrived! Meet them at the pickup point.'
      });

      socket.emit('ride:arrival_confirmed', { ride: updatedRide });
      io.to('role:admin').emit('admin:ride_event', { type: 'DRIVER_ARRIVED', ride: updatedRide });
    });

    // Driver verifies OTP and starts the ride
    socket.on('ride:start', async ({ rideId, driverId, otp }) => {
      const ride = db.getRideById(rideId);
      if (!ride) return;

      if (ride.otp && otp && ride.otp.trim() !== otp.trim()) {
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
    });

    // Driver completes the trip
    socket.on('ride:complete', ({ rideId, driverId }) => {
      completeRideWorkflow(io, rideId, driverId);
    });

    // Rider submits rating & tip
    socket.on('ride:rate_and_tip', ({ rideId, riderId, rating, tip = 0, feedback }) => {
      const ride = db.getRideById(rideId);
      if (!ride) return;

      const updatedRide = db.updateRide(rideId, {
        rating,
        tip,
        feedback,
        ratedAt: new Date().toISOString()
      });

      // If tip provided, handle tip transaction
      if (tip > 0 && ride.driverId) {
        const driver = db.getDriverById(ride.driverId);
        const rider = db.getUserById(riderId);

        if (rider && driver) {
          db.updateUser(riderId, { walletBalance: (rider.walletBalance || 0) - tip });
          db.updateDriver(ride.driverId, { 
            walletBalance: (driver.walletBalance || 0) + tip,
            earningsToday: (driver.earningsToday || 0) + tip
          });

          db.addTransaction({
            userId: riderId,
            amount: -tip,
            type: 'TIP',
            description: `Driver Tip for trip to ${ride.destination.address.split(',')[0]}`
          });

          db.addTransaction({
            userId: ride.driverId,
            amount: tip,
            type: 'TIP',
            description: `Received Tip from ${rider.name}`
          });
        }
      }

      socket.emit('ride:rated_confirmation', { ride: updatedRide });
      if (ride.driverId) {
        io.to(`user:${ride.driverId}`).emit('driver:received_review', {
          rating,
          tip,
          feedback
        });
      }
    });

    // In-trip Rider-Driver Chat
    socket.on('chat:send', ({ rideId, senderId, senderName, senderRole, text }) => {
      const ride = db.getRideById(rideId);
      if (!ride) return;

      const message = {
        id: `msg-${Date.now()}`,
        rideId,
        senderId,
        senderName,
        senderRole,
        text,
        timestamp: new Date().toISOString()
      };

      const recipientId = senderId === ride.riderId ? ride.driverId : ride.riderId;
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('chat:message', message);
      }
      socket.emit('chat:message', message);
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      if (currentUserId) {
        userSockets.delete(currentUserId);
      }
    });
  });

  // Background smooth cruising loop for idle online drivers
  startIdleDriversCruising(io);
}

/**
 * Handle Complete Ride Settlement
 */
function completeRideWorkflow(io, rideId, driverId) {
  const ride = db.getRideById(rideId);
  const driver = db.getDriverById(driverId);
  const settings = db.getSettings();
  if (!ride || !driver) return;

  const commissionRate = (settings.platformCommissionPercent || 20) / 100;
  const platformCut = Number((ride.fare * commissionRate).toFixed(2));
  const driverEarnings = Number((ride.fare - platformCut).toFixed(2));

  // Update statuses
  db.updateDriver(driverId, {
    status: 'ONLINE',
    earningsToday: (driver.earningsToday || 0) + driverEarnings,
    walletBalance: (driver.walletBalance || 0) + driverEarnings,
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
  if (rider && ride.paymentMethod === 'WALLET') {
    db.updateUser(ride.riderId, {
      walletBalance: (rider.walletBalance || 0) - ride.fare,
      totalRides: (rider.totalRides || 0) + 1
    });

    db.addTransaction({
      userId: ride.riderId,
      amount: -ride.fare,
      type: 'RIDE_PAYMENT',
      description: `Ride to ${ride.destination.address.split(',')[0]}`
    });
  }

  // Driver transaction
  db.addTransaction({
    userId: driverId,
    amount: driverEarnings,
    type: 'DRIVER_PAYOUT',
    description: `Trip Earnings (Fare $${ride.fare} - Platform Fee $${platformCut})`
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
    totalToday: (driver.earningsToday || 0) + driverEarnings
  });

  io.emit('driver:status_changed', { driverId, status: 'ONLINE' });
  io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_COMPLETED', ride: updatedRide });
}

/**
 * Auto-acceptance for testing / demo
 */
async function simulateAutoDriverAcceptance(io, rideId) {
  const ride = db.getRideById(rideId);
  if (!ride || ride.status !== 'REQUESTED') return;

  const drivers = db.getDrivers();
  const availableDriver = drivers.find(d => d.status === 'ONLINE') || drivers[0];
  if (!availableDriver) return;

  db.updateDriver(availableDriver.id, { status: 'BUSY' });
  const toPickupRoute = await getDrivingRoute(availableDriver.location, ride.pickup);

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
    rider: db.getUserById(ride.riderId),
    routeToPickup: toPickupRoute
  });

  io.emit('driver:status_changed', { driverId: availableDriver.id, status: 'BUSY' });

  // Move driver towards pickup
  startDriverMovementSimulation(io, availableDriver.id, toPickupRoute.coordinates, 'TO_PICKUP', rideId);
}

/**
 * Smooth simulated driver vehicle animation along GPS route
 */
function startDriverMovementSimulation(io, driverId, coordinates, phase, rideId) {
  if (!coordinates || coordinates.length === 0) return;

  let index = 0;
  const totalSteps = coordinates.length;
  // Interval speed: calculate step time to make trip preview realistic & engaging (10-15 seconds total)
  const stepDelay = Math.max(400, Math.min(1200, Math.floor(12000 / totalSteps)));

  const timer = setInterval(() => {
    index++;
    if (index >= totalSteps) {
      clearInterval(timer);
      const finalCoord = coordinates[totalSteps - 1];
      db.updateDriver(driverId, {
        location: { lat: finalCoord[0], lng: finalCoord[1], heading: 0 }
      });

      if (phase === 'TO_PICKUP') {
        // Driver arrives
        const ride = db.getRideById(rideId);
        if (ride && (ride.status === 'ACCEPTED' || ride.status === 'REQUESTED')) {
          const updatedRide = db.updateRide(rideId, { status: 'ARRIVED', arrivedAt: new Date().toISOString() });
          io.to(`user:${ride.riderId}`).emit('ride:driver_arrived', {
            ride: updatedRide,
            message: 'Your driver has arrived!'
          });
          io.to(`user:${driverId}`).emit('ride:arrival_confirmed', { ride: updatedRide });
        }
      } else if (phase === 'TO_DESTINATION') {
        // Trip completes
        const ride = db.getRideById(rideId);
        if (ride && ride.status === 'IN_PROGRESS') {
          completeRideWorkflow(io, rideId, driverId);
        }
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
    });

    const remainingSteps = totalSteps - index;
    const remainingKm = Number(((remainingSteps / totalSteps) * 2.5).toFixed(2));
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
}

/**
 * Keep idle online drivers gently moving in the city
 */
function startIdleDriversCruising(io) {
  setInterval(() => {
    const drivers = db.getDrivers().filter(d => d.status === 'ONLINE');
    drivers.forEach(d => {
      // Small random drift simulating cruising (approx 20-30 meters)
      const dLat = (Math.random() - 0.5) * 0.0004;
      const dLng = (Math.random() - 0.5) * 0.0004;
      const newLat = d.location.lat + dLat;
      const newLng = d.location.lng + dLng;
      const heading = calculateHeading(d.location.lat, d.location.lng, newLat, newLng);

      const updated = db.updateDriver(d.id, {
        location: { lat: newLat, lng: newLng, heading }
      });

      io.emit('driver:moved', {
        driverId: d.id,
        location: updated.location,
        status: updated.status,
        heading
      });
    });
  }, 4000);
}

module.exports = {
  setupSocketIO
};
