import React, { useState, useEffect } from 'react';
import {
  Radio,
  Power,
  Navigation,
  DollarSign,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  MapPin,
  Compass,
  AlertCircle,
  Phone,
  MessageSquare,
  Shield,
  KeyRound,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { socket } from '../../services/socket';
import { sound } from '../../utils/audio';

export default function DriverView({
  driver,
  activeRide,
  onRideUpdate,
  onStatusChange
}) {
  const [isOnline, setIsOnline] = useState(driver?.status === 'ONLINE');
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [acceptTimer, setAcceptTimer] = useState(15);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [currentManeuver, setCurrentManeuver] = useState({
    instruction: 'Continue on 5th Avenue towards pickup',
    distance: '350m'
  });

  // Handle Socket Events for Driver
  useEffect(() => {
    socket.on('ride:incoming_request', (data) => {
      setIncomingRequest(data);
      setAcceptTimer(15);
      sound.playRideRequest();
    });

    socket.on('ride:accepted_confirmation', (data) => {
      onRideUpdate(data.ride);
      setIncomingRequest(null);
    });

    socket.on('ride:arrival_confirmed', (data) => {
      onRideUpdate(data.ride);
    });

    socket.on('ride:started_confirmation', (data) => {
      onRideUpdate(data.ride);
      setOtpError('');
    });

    socket.on('ride:completed_confirmation', (data) => {
      onRideUpdate(null);
      sound.playTripCompleted();
    });

    // The rider called it off - clear the trip so the driver is free again.
    socket.on('ride:cancelled', () => {
      onRideUpdate(null);
      setIncomingRequest(null);
      setEnteredOtp('');
      setOtpError('');
    });

    socket.on('ride:error', (err) => {
      setOtpError(err.message || 'Invalid PIN');
    });

    return () => {
      socket.off('ride:incoming_request');
      socket.off('ride:accepted_confirmation');
      socket.off('ride:arrival_confirmed');
      socket.off('ride:started_confirmation');
      socket.off('ride:completed_confirmation');
      socket.off('ride:cancelled');
      socket.off('ride:error');
    };
  }, []);

  // 15-second countdown timer for incoming requests
  useEffect(() => {
    let interval = null;
    if (incomingRequest && acceptTimer > 0) {
      interval = setInterval(() => {
        setAcceptTimer((prev) => {
          if (prev <= 1) {
            setIncomingRequest(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [incomingRequest, acceptTimer]);

  // Toggle Online/Offline
  const toggleOnline = () => {
    const nextStatus = isOnline ? 'OFFLINE' : 'ONLINE';
    setIsOnline(!isOnline);
    if (onStatusChange) {
      onStatusChange(nextStatus);
    }
    socket.emit('driver:set_status', {
      driverId: driver?.id || 'driver-01',
      status: nextStatus
    });
  };

  // Accept incoming ride
  const handleAcceptRide = () => {
    if (!incomingRequest) return;
    socket.emit('ride:accept', {
      rideId: incomingRequest.ride.id,
      driverId: driver?.id || 'driver-01'
    });
    setIncomingRequest(null);
  };

  // Decline incoming ride
  const handleDeclineRide = () => {
    setIncomingRequest(null);
  };

  // Step 1: Driver Arrived at Pickup
  const handleDriverArrived = () => {
    if (!activeRide) return;
    socket.emit('ride:arrived', {
      rideId: activeRide.id,
      driverId: driver?.id || 'driver-01'
    });
  };

  // Step 2: Verify OTP & Start Trip
  const handleStartTrip = () => {
    if (!activeRide) return;
    if (!enteredOtp || enteredOtp.length !== 4) {
      setOtpError('Please enter the 4-digit PIN provided by the rider');
      return;
    }
    socket.emit('ride:start', {
      rideId: activeRide.id,
      driverId: driver?.id || 'driver-01',
      otp: enteredOtp
    });
  };

  // Step 3: Complete Trip
  const handleCompleteTrip = () => {
    if (!activeRide) return;
    socket.emit('ride:complete', {
      rideId: activeRide.id,
      driverId: driver?.id || 'driver-01'
    });
    setEnteredOtp('');
  };

  const tripLocation = activeRide?.status === 'ACCEPTED'
    ? activeRide?.pickup
    : activeRide?.destination;
  const driverFare = Number(activeRide?.fare);
  const fareEarned = Number.isFinite(driverFare) ? `$${(driverFare * 0.8).toFixed(2)}` : '--';

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      {/* 1. ONLINE / OFFLINE TOGGLE & EARNINGS HEADER */}
      <div className="glass-card rounded-3xl p-5 shadow-2xl border border-white/10 flex flex-col gap-4">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${isOnline ? 'bg-uber-green animate-pulse glow-green' : 'bg-gray-600'}`} />
            <div>
              <h2 className="text-base font-extrabold text-white">
                {isOnline ? 'You are Online' : 'You are Offline'}
              </h2>
              <p className="text-[11px] text-gray-400">
                {isOnline ? 'Ready to accept incoming trip requests' : 'Go online to start receiving rides'}
              </p>
            </div>
          </div>

          {/* Big Toggle Switch */}
          <button
            onClick={toggleOnline}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all shadow-lg active:scale-95 ${
              isOnline
                ? 'bg-uber-green text-black hover:bg-uber-greenHover shadow-uber-green/20'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isOnline ? 'ONLINE' : 'GO ONLINE'}</span>
          </button>
        </div>

        {/* Driver Quick Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
          <div className="bg-black/30 p-2.5 rounded-2xl border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-gray-400">Today</span>
            <p className="text-sm font-extrabold text-uber-green mt-0.5">
              ${driver?.earningsToday || '184.20'}
            </p>
          </div>
          <div className="bg-black/30 p-2.5 rounded-2xl border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-gray-400">Trips</span>
            <p className="text-sm font-extrabold text-white mt-0.5">
              {driver?.totalTrips || '1,420'}
            </p>
          </div>
          <div className="bg-black/30 p-2.5 rounded-2xl border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-gray-400">Rating</span>
            <p className="text-sm font-extrabold text-uber-gold mt-0.5">
              ★ {driver?.rating || '4.96'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE TRIP NAVIGATION & ACTION CONTROLS */}
      {activeRide && (
        <div className="glass-card rounded-3xl p-5 shadow-2xl border border-white/10 flex flex-col gap-4 animate-in slide-in-from-bottom-3">
          
          {/* Turn-By-Turn HUD Banner */}
          <div className="bg-gradient-to-r from-uber-accent/20 to-blue-900/30 p-3.5 rounded-2xl border border-uber-accent/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-uber-accent flex items-center justify-center text-white shadow-md glow-accent">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-uber-accent">Next Maneuver</span>
                <p className="text-xs font-bold text-white mt-0.5">{currentManeuver.instruction}</p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-uber-accent px-2 py-1 rounded-lg bg-uber-accent/10 border border-uber-accent/20">
              {currentManeuver.distance}
            </span>
          </div>

          {/* Trip Destination / Passenger Details */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {activeRide.status === 'ACCEPTED' ? 'Pickup Location' : 'Destination'}
              </span>
              <p className="text-xs font-bold text-white truncate max-w-[220px] mt-0.5">
                {tripLocation?.address || 'Location pending'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400">Fare Earned</span>
              <p className="text-sm font-extrabold text-uber-green">{fareEarned}</p>
            </div>
          </div>

          {/* STAGE 1: NAVIGATING TO PICKUP -> TAP ARRIVED */}
          {activeRide.status === 'ACCEPTED' && (
            <button
              onClick={handleDriverArrived}
              className="w-full py-4 rounded-2xl bg-uber-accent hover:bg-uber-accentHover font-extrabold text-white text-sm shadow-xl shadow-uber-accent/30 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>I Have Arrived at Pickup</span>
            </button>
          )}

          {/* STAGE 2: DRIVER ARRIVED -> ENTER RIDER 4-DIGIT PIN */}
          {activeRide.status === 'ARRIVED' && (
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/50 border border-uber-gold/30">
              <div className="flex items-center gap-2 text-uber-gold text-xs font-bold">
                <KeyRound className="w-4 h-4" />
                <span>Ask Rider for 4-Digit Security PIN</span>
              </div>

              <input
                type="text"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value)}
                className="bg-black/60 text-center text-xl font-extrabold tracking-widest text-white py-2 rounded-xl border border-white/20 focus:border-uber-gold focus:outline-none"
              />

              {otpError && (
                <p className="text-[11px] text-uber-red font-bold text-center">{otpError}</p>
              )}

              <button
                onClick={handleStartTrip}
                className="w-full py-3.5 rounded-xl bg-uber-gold hover:bg-yellow-400 font-extrabold text-black text-xs shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>Verify PIN & Start Trip</span>
              </button>
            </div>
          )}

          {/* STAGE 3: IN PROGRESS -> COMPLETE TRIP */}
          {activeRide.status === 'IN_PROGRESS' && (
            <button
              onClick={handleCompleteTrip}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-uber-green to-emerald-600 hover:from-uber-greenHover hover:to-emerald-700 font-extrabold text-black text-sm shadow-xl shadow-uber-green/30 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Complete Trip & Collect {fareEarned}</span>
            </button>
          )}
        </div>
      )}

      {/* 3. INCOMING RIDE REQUEST POPUP (15-SECOND ACCEPTANCE MODAL) */}
      {incomingRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-6 border-2 border-uber-accent shadow-2xl flex flex-col gap-4 text-center animate-in zoom-in-95">
            
            {/* Timer Ring */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-white/10 border-t-uber-accent animate-spin" style={{ animationDuration: '15s' }} />
              <span className="absolute text-2xl font-extrabold text-white">{acceptTimer}s</span>
            </div>

            <div>
              <span className="text-[11px] uppercase font-bold px-3 py-1 rounded-full bg-uber-accent/20 text-uber-accent border border-uber-accent/30">
                {incomingRequest.ride.category} Request
              </span>
              <h3 className="text-2xl font-extrabold text-white mt-2">
                ${incomingRequest.estimatedEarnings}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {incomingRequest.pickupDistanceKm} km away • ~{incomingRequest.pickupDurationMin} min pickup
              </p>
            </div>

            {/* Rider details */}
            <div className="bg-black/50 p-3.5 rounded-2xl border border-white/10 text-left text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{incomingRequest.rider.name}</span>
                <span className="text-uber-gold font-bold">★ {incomingRequest.rider.rating}</span>
              </div>
              <div className="flex items-start gap-2 text-gray-300">
                <MapPin className="w-3.5 h-3.5 text-uber-accent mt-0.5 flex-shrink-0" />
                <span className="truncate">{incomingRequest.ride.pickup.address}</span>
              </div>
            </div>

            {/* Accept & Decline Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDeclineRide}
                className="py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs transition-all"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptRide}
                className="py-3.5 rounded-2xl bg-uber-green hover:bg-uber-greenHover text-black font-extrabold text-xs shadow-lg shadow-uber-green/30 transition-all active:scale-95"
              >
                Accept ({acceptTimer}s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
