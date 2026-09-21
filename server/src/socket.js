const db = require('./db');
const { calculateHeading, getDrivingRoute } = require('./services/routing');
const { calculateFare } = require('./services/pricing');
const ivrService = require('./services/ivrService');

function setupSocketIO(io) {
  // Connected socket mappings: userId -> socketId
  const userSockets = new Map();
  // Active dispatch timers and queues: rideId -> { candidateDrivers: [], currentIndex: number, timer: NodeJS.Timeout }
  const dispatchSessions = new Map();
  // Active route simulation timers: driverId -> timer
  const activeSimulations = new Map();

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
        socket.join(`role:${role.toUpperCase()}`);
      }

      // If driver, also join driver's id and userId rooms
      if (role === 'DRIVER') {
        const driver = db.getDriverById(userId);
        if (driver) {
          socket.join(`user:${driver.id}`);
          userSockets.set(driver.id, socket.id);
          if (driver.userId) {
            socket.join(`user:${driver.userId}`);
            userSockets.set(driver.userId, socket.id);
          }
        }
      }

      const activeRide = db.getActiveRideForUser(userId);

      // Send initial state snapshot with active ride restored
      socket.emit('init:state', {
        drivers: db.getDrivers(),
        activeRide: activeRide || null,
        settings: db.getSettings()
      });

      // If reconnecting and has an active ride, restore room & state
      if (activeRide) {
        socket.join(`ride:${activeRide.id}`);
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

    socket.on('driver:status', ({ driverId, status, destinationMode }) => {
      const updated = db.updateDriver(driverId, { status });
      if (destinationMode !== undefined) {
        db.setDriverDestination(driverId, destinationMode);
      }
      if (updated) {
        io.emit('driver:status_changed', { driverId, status, destinationMode });
      }
    });

    // Arrival wait timer with grace period fee broadcast
    socket.on('trip:wait_timer', ({ rideId, waitingSeconds, waitingFee }) => {
      if (rideId) {
        io.to(`ride:${rideId}`).emit('trip:wait_timer_update', { rideId, waitingSeconds, waitingFee });
      }
    });

    // Driver cancels with reason code
    socket.on('ride:cancel_reason', ({ rideId, driverId, reason }) => {
      if (rideId) {
        const updated = db.updateRide(rideId, {
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date().toISOString()
        });
        if (driverId) {
          db.updateDriver(driverId, { status: 'ONLINE' });
          io.emit('driver:status_changed', { driverId, status: 'ONLINE' });
        }
        io.to(`ride:${rideId}`).emit('ride:cancelled_by_driver', {
          rideId,
          reason,
          message: `Driver cancelled trip: ${reason}`
        });
        io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updated, reason });
        io.to('role:ADMIN').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updated, reason });
        io.emit('ride:updated', updated);
      }
    });

    // Rider requests a ride
    socket.on('ride:request', async (requestData) => {
      const { riderId, pickup, destination, category, paymentMethod = 'WALLET' } = requestData;
      const settings = db.getSettings();

      try {
        // Calculate driving route using OSRM
        const routeInfo = await getDrivingRoute(pickup, destination);
        const fareInfo = calculateFare({
          category,
          distanceKm: routeInfo.distanceKm,
          durationMin: routeInfo.durationMin,
          surgeMultiplier: settings.surgeMultiplier
        });

        // Create new ride record in SQLite
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

        socket.join(`ride:${newRide.id}`);

        // Notify rider that request is submitted
        socket.emit('ride:created', newRide);
        io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_REQUESTED', ride: newRide });

        // Dispatch by ETA (OSRM)
        dispatchRideByEta(io, newRide, dispatchSessions);

      } catch (err) {
        console.error('Failed to dispatch ride:', err);
        socket.emit('ride:error', { message: 'Could not calculate route. Please try a different location.' });
      }
    });

    // Rider cancels request before pickup
    socket.on('ride:cancel', ({ rideId, riderId }) => {
      const ride = db.getRideById(rideId);
      if (!ride || !['REQUESTED', 'MATCHING', 'ACCEPTED'].includes(ride.status)) return;

      // Clean up dispatch session if pending
      if (dispatchSessions.has(rideId)) {
        const session = dispatchSessions.get(rideId);
        if (session.timer) clearTimeout(session.timer);
        if (session.currentDriverId) {
          io.to(`user:${session.currentDriverId}`).emit('ride:request_cancelled', { rideId });
        }
        dispatchSessions.delete(rideId);
      }

      // If a driver was already assigned, free them
      if (ride.driverId) {
        db.updateDriver(ride.driverId, { status: 'ONLINE' });
        io.emit('driver:status_changed', { driverId: ride.driverId, status: 'ONLINE' });
        io.to(`user:${ride.driverId}`).emit('ride:cancelled_by_rider', { rideId, message: 'The rider has cancelled this trip.' });
      }

      const updatedRide = db.updateRide(rideId, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Cancelled by rider'
      });

      io.to(`user:${ride.riderId}`).emit('ride:cancelled', { ride: updatedRide });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_CANCELLED', ride: updatedRide });
    });

    // Driver accepts ride request within the 15-second window
    socket.on('ride:accept', async ({ rideId, driverId }) => {
      const session = dispatchSessions.get(rideId);
      if (session) {
        if (session.timer) clearTimeout(session.timer);
        dispatchSessions.delete(rideId);
      }

      const ride = db.getRideById(rideId);
      const driver = db.getDriverById(driverId);
      if (!ride || !driver) return;

      db.updateDriver(driverId, { status: 'BUSY' });
      
      // Calculate driver to pickup route for live navigation
      const toPickupRoute = await getDrivingRoute(driver.location, ride.pickup);
      
      const updatedRide = db.updateRide(rideId, {
        driverId,
        status: 'ACCEPTED',
        acceptedAt: new Date().toISOString(),
        driverRouteCoordinates: toPickupRoute.coordinates,
        etaToPickupMin: toPickupRoute.durationMin
      });

      const rider = db.getUserById(ride.riderId);
      socket.join(`ride:${rideId}`);

      // Broadcast to Rider
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

      // Confirm to Driver
      socket.emit('ride:accepted_confirmation', {
        ride: updatedRide,
        rider,
        routeToPickup: toPickupRoute
      });

      io.emit('driver:status_changed', { driverId, status: 'BUSY' });
      io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_ACCEPTED', ride: updatedRide, driver });

      // Start automatic simulated smooth GPS progression to pickup
      startDriverMovementSimulation(io, driverId, toPickupRoute.coordinates, 'TO_PICKUP', rideId, activeSimulations);
    });

    // Driver explicitly declines ride request
    socket.on('ride:decline', ({ rideId, driverId }) => {
      handleDriverDeclineOrTimeout(io, rideId, driverId, dispatchSessions);
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

    // Driver verifies OTP PIN and starts the ride
    socket.on('ride:start', async ({ rideId, driverId, otp }) => {
      const ride = db.getRideById(rideId);
      if (!ride) return;

      // 4-digit security PIN verification
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
      startDriverMovementSimulation(io, driverId, toDestinationRoute.coordinates, 'TO_DESTINATION', rideId, activeSimulations);
    });

    // Driver completes the trip
    socket.on('ride:complete', ({ rideId, driverId }) => {
      completeRideWorkflow(io, rideId, driverId, activeSimulations);
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

      if (tip > 0 && ride.driverId) {
        const driver = db.getDriverById(ride.driverId);
        const rider = db.getUserById(riderId);

        if (rider && driver) {
          db.updateUser(riderId, { walletBalance: Math.max(0, (rider.walletBalance || 0) - tip) });
          db.updateDriver(ride.driverId, { 
            walletBalance: (driver.walletBalance || 0) + tip,
            earningsToday: (driver.earningsToday || 0) + tip
          });

          db.addTransaction({
            userId: riderId,
            amount: -tip,
            type: 'TIP',
            description: `Driver Tip for trip to ${ride.destination.address?.split(',')[0] || 'Destination'}`
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

    // SOS Emergency Broadcast
    socket.on('ride:sos', ({ rideId, userId, location, note }) => {
      const ride = db.getRideById(rideId);
      const user = db.getUserById(userId);
      const sosAlert = {
        id: `sos-${Date.now()}`,
        rideId,
        userId,
        userName: user ? user.name : 'Passenger',
        userPhone: user ? user.phone : 'Emergency Dispatch',
        location,
        note: note || 'SOS Emergency Button Triggered!',
        timestamp: new Date().toISOString()
      };

      // Broadcast immediately to admin god-view and both parties
      io.to('role:admin').emit('admin:sos_alert', sosAlert);
      if (ride) {
        io.to(`user:${ride.riderId}`).emit('ride:sos_received', sosAlert);
        if (ride.driverId) {
          io.to(`user:${ride.driverId}`).emit('ride:sos_received', sosAlert);
        }
      }
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
 * Dispatch by ETA (OSRM): Calculate driving duration for all online drivers and dispatch sequentially
 */
async function dispatchRideByEta(io, ride, dispatchSessions) {
  const onlineDrivers = db.getDrivers().filter(d => d.status === 'ONLINE');
  const rider = db.getUserById(ride.riderId);
  const settings = db.getSettings();

  if (onlineDrivers.length === 0) {
    // Cleanly notify rider when no drivers are currently available
    io.to(`user:${ride.riderId}`).emit('ride:no_drivers_found', {
      rideId: ride.id,
      message: 'No drivers are currently online in your area. Please try again in a moment.'
    });
    return;
  }

  // Calculate ETA for each driver to the pickup location via OSRM
  const etaPromises = onlineDrivers.map(async (driver) => {
    try {
      const route = await getDrivingRoute(driver.location, ride.pickup);
      return {
        driver,
        durationMin: route.durationMin,
        distanceKm: route.distanceKm,
        route
      };
    } catch (e) {
      return {
        driver,
        durationMin: 999,
        distanceKm: 999,
        route: null
      };
    }
  });

  const candidatesWithEta = await Promise.all(etaPromises);
  // Sort ascending by ETA
  candidatesWithEta.sort((a, b) => a.durationMin - b.durationMin);

  const session = {
    rideId: ride.id,
    candidates: candidatesWithEta,
    currentIndex: 0,
    currentDriverId: null,
    timer: null,
    rider,
    settings
  };

  dispatchSessions.set(ride.id, session);
  sendIncomingRequestToCurrentCandidate(io, session, dispatchSessions);
}

/**
 * Send incoming request with 15s acceptance window to candidate at session.currentIndex
 */
function sendIncomingRequestToCurrentCandidate(io, session, dispatchSessions) {
  const { rideId, candidates, currentIndex, rider, settings } = session;

  if (currentIndex >= candidates.length) {
    // All drivers declined or timed out
    dispatchSessions.delete(rideId);
    const ride = db.getRideById(rideId);
    if (ride && ride.status === 'REQUESTED') {
      io.to(`user:${ride.riderId}`).emit('ride:no_drivers_found', {
        rideId,
        message: 'Nearby drivers are currently unavailable. Would you like to retry?'
      });
    }
    return;
  }

  const candidate = candidates[currentIndex];
  session.currentDriverId = candidate.driver.id;

  const ride = db.getRideById(rideId);
  if (!ride || ride.status !== 'REQUESTED') {
    dispatchSessions.delete(rideId);
    return;
  }

  // Notify the candidate driver
  io.to(`user:${candidate.driver.id}`).emit('ride:incoming_request', {
    ride,
    rider: {
      name: rider?.name || 'Passenger',
      rating: rider?.rating || 4.9,
      avatar: rider?.avatar
    },
    pickupDistanceKm: candidate.distanceKm,
    pickupDurationMin: candidate.durationMin,
    estimatedEarnings: Number((ride.fare * (1 - (settings.platformCommissionPercent || 20) / 100)).toFixed(2)),
    timeoutSeconds: 15
  });

  // Automated IVR Voice Dispatch to driver's keypad phone
  try {
    ivrService.initiateKeypadDispatch({
      driverPhone: candidate.driver.phone || '+91 98765 43210',
      driverId: candidate.driver.id,
      ride
    });
  } catch (err) {
    console.warn('IVR automated dispatch notice:', err.message);
  }

  // Notify rider that dispatch is searching candidate
  io.to(`user:${ride.riderId}`).emit('ride:dispatch_status', {
    status: 'SEARCHING',
    attempt: currentIndex + 1,
    totalAttempts: candidates.length,
    message: `Contacting nearest driver (${candidate.durationMin} mins away)...`
  });

  // 15-second acceptance countdown timer: if expired, failover to next candidate
  session.timer = setTimeout(() => {
    // Notify candidate that request timed out
    io.to(`user:${candidate.driver.id}`).emit('ride:request_timeout', { rideId });
    handleDriverDeclineOrTimeout(io, rideId, candidate.driver.id, dispatchSessions);
  }, 15000);
}

/**
 * Failover to the next nearest driver upon decline or 15s timeout
 */
function handleDriverDeclineOrTimeout(io, rideId, driverId, dispatchSessions) {
  const session = dispatchSessions.get(rideId);
  if (!session) return;

  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }

  // Close request modal on that driver
  io.to(`user:${driverId}`).emit('ride:request_closed', { rideId });

  // Advance to next driver
  session.currentIndex++;
  sendIncomingRequestToCurrentCandidate(io, session, dispatchSessions);
}

/**
 * Handle Complete Ride Settlement
 */
function completeRideWorkflow(io, rideId, driverId, activeSimulations) {
  // Clear any running simulation for this driver
  if (activeSimulations.has(driverId)) {
    clearInterval(activeSimulations.get(driverId));
    activeSimulations.delete(driverId);
  }

  const ride = db.getRideById(rideId);
  const driver = db.getDriverById(driverId);
  const settings = db.getSettings();
  if (!ride || !driver) return;

  const commissionRate = (settings.platformCommissionPercent || 20) / 100;
  const platformCut = Number((ride.fare * commissionRate).toFixed(2));
  const driverEarnings = Number((ride.fare - platformCut).toFixed(2));

  // Update driver stats
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

  // Deduct fare from rider wallet
  const rider = db.getUserById(ride.riderId);
  if (rider) {
    db.updateUser(ride.riderId, {
      walletBalance: Math.max(0, Number(((rider.walletBalance || 0) - ride.fare).toFixed(2))),
      totalRides: (rider.totalRides || 0) + 1
    });

    db.addTransaction({
      userId: ride.riderId,
      amount: -ride.fare,
      type: 'RIDE_PAYMENT',
      description: `Ride to ${ride.destination.address?.split(',')[0] || 'Destination'}`
    });
  }

  // Add driver earnings transaction
  db.addTransaction({
    userId: driverId,
    amount: driverEarnings,
    type: 'DRIVER_PAYOUT',
    description: `Trip Earnings (Fare $${ride.fare} - Platform Fee $${platformCut})`
  });

  // Notify Rider with itemized receipt
  io.to(`user:${ride.riderId}`).emit('ride:completed', {
    ride: updatedRide,
    receipt: {
      fare: ride.fare,
      distanceKm: ride.distanceKm,
      durationMin: ride.durationMin,
      platformFee: platformCut,
      paymentMethod: ride.paymentMethod,
      completedAt: updatedRide.completedAt
    }
  });

  // Notify Driver with earnings confirmation
  io.to(`user:${driverId}`).emit('ride:completed_confirmation', {
    ride: updatedRide,
    earnings: driverEarnings,
    totalToday: Number(((driver.earningsToday || 0) + driverEarnings).toFixed(2))
  });

  io.emit('driver:status_changed', { driverId, status: 'ONLINE' });
  io.to('role:admin').emit('admin:ride_event', { type: 'RIDE_COMPLETED', ride: updatedRide });
}

/**
 * Smooth simulated driver vehicle animation along GPS route
 */
function startDriverMovementSimulation(io, driverId, coordinates, phase, rideId, activeSimulations) {
  if (!coordinates || coordinates.length === 0) return;

  if (activeSimulations.has(driverId)) {
    clearInterval(activeSimulations.get(driverId));
  }

  let index = 0;
  const totalSteps = coordinates.length;
  const stepDelay = Math.max(300, Math.min(900, Math.floor(10000 / totalSteps)));

  const timer = setInterval(() => {
    index++;
    if (index >= totalSteps) {
      clearInterval(timer);
      activeSimulations.delete(driverId);
      const finalCoord = coordinates[totalSteps - 1];
      db.updateDriver(driverId, {
        location: { lat: finalCoord[0], lng: finalCoord[1], heading: 0 }
      });

      if (phase === 'TO_PICKUP') {
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
        const ride = db.getRideById(rideId);
        if (ride && ride.status === 'IN_PROGRESS') {
          completeRideWorkflow(io, rideId, driverId, activeSimulations);
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

  activeSimulations.set(driverId, timer);
}

/**
 * Keep idle online drivers gently moving in the city
 */
function startIdleDriversCruising(io) {
  setInterval(() => {
    const drivers = db.getDrivers().filter(d => d.status === 'ONLINE');
    drivers.forEach(d => {
      const dLat = (Math.random() - 0.5) * 0.0003;
      const dLng = (Math.random() - 0.5) * 0.0003;
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
