import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  DollarSign, 
  Star, 
  X, 
  Check, 
  Zap, 
  Clock, 
  AlertCircle,
  Flame,
  ArrowRight
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function DriverRideRequestSheet({
  request,
  onAccept,
  onDecline,
  autoAccept = false
}) {
  const [timer, setTimer] = useState(15);
  const [showDeclineReasons, setShowDeclineReasons] = useState(false);

  // SVG Ring calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timer / 15) * circumference;

  // Auto-Accept or Countdown Timer
  useEffect(() => {
    if (!request) return;

    // If auto-accept is enabled, accept immediately after a quick sound chime!
    if (autoAccept) {
      const autoTimer = setTimeout(() => {
        onAccept(request);
      }, 600);
      return () => clearTimeout(autoTimer);
    }

    setTimer(15);
    try {
      sound.playRideRequest();
    } catch (e) {}

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Timeout counts as a miss!
          onDecline(request, 'TIMEOUT_MISSED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [request, autoAccept]);

  if (!request) return null;

  const ride = request.ride || {};
  const rider = request.rider || { name: 'Passenger', rating: 4.95 };
  const estimatedEarnings = request.estimatedEarnings || ride.fare || 24.50;
  const pickupDistanceKm = request.pickupDistanceKm || 2.1;
  const pickupDurationMin = request.pickupDurationMin || 5;
  const tripDistanceKm = ride.distanceKm || 6.8;
  const surgeMultiplier = ride.surgeMultiplier || request.surgeMultiplier || 1.0;

  const declineReasons = [
    'Pickup is too far',
    'Fare is too low',
    'Need a break',
    'Heading opposite direction',
    'Safety concerns'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in">
      
      {/* DECLINE REASONS MODAL */}
      {showDeclineReasons ? (
        <div className="glass-card max-w-sm w-full rounded-3xl p-5 border border-white/20 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 bg-[#121216]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">Decline Reason</h3>
            <button 
              onClick={() => setShowDeclineReasons(false)}
              className="touch-target text-gray-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Please share why you're declining. This helps optimize future ride matching for your preferences.
          </p>

          <div className="flex flex-col gap-2">
            {declineReasons.map((reason) => (
              <button
                key={reason}
                onClick={() => {
                  onDecline(request, reason);
                  setShowDeclineReasons(false);
                }}
                className="touch-target w-full text-left p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-200 border border-white/5 hover:border-red-500/30 hover:text-red-300 transition-all"
              >
                {reason}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowDeclineReasons(false)}
            className="touch-target w-full py-2.5 rounded-xl bg-white/10 text-gray-400 text-xs font-bold hover:text-white"
          >
            Back to Request
          </button>
        </div>
      ) : (
        /* BOTTOM-SHEET RIDE DISPATCH CARD */
        <div className="glass-card max-w-md w-full rounded-3xl p-5 border-2 border-blue-500/80 shadow-2xl flex flex-col gap-4 bg-[#121216] animate-in slide-in-from-bottom-4">
          
          {/* TOP HEADER WITH COUNTDOWN RING & EARNINGS */}
          <div className="flex items-center justify-between">
            
            {/* SVG 15-SECOND COUNTDOWN RING */}
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-20 h-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="5"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="#276EF1"
                  strokeWidth="5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-black text-white">{timer}</span>
                <span className="text-[8px] uppercase font-bold text-gray-400">sec</span>
              </div>
            </div>

            {/* ESTIMATED EARNINGS & TIER */}
            <div className="text-right flex-1 pl-4">
              <div className="flex items-center justify-end gap-1.5 mb-1">
                {surgeMultiplier > 1.0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3" /> {surgeMultiplier}x SURGE
                  </span>
                )}
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                  {ride.category || 'NexComfort'}
                </span>
              </div>
              <h3 className="text-3xl font-black text-emerald-400">
                ${parseFloat(estimatedEarnings).toFixed(2)}
              </h3>
              <p className="text-[11px] text-gray-400 font-semibold">
                Est. Net Earnings (incl. surge)
              </p>
            </div>
          </div>

          {/* DISTANCES & TIMING PILL BAR */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-black/50 border border-white/5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Navigation className="w-3.5 h-3.5 rotate-45" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Pickup</span>
                <span className="text-white font-black">{pickupDistanceKm} km • ~{pickupDurationMin}m</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Trip Distance</span>
                <span className="text-white font-black">{tripDistanceKm} km</span>
              </div>
            </div>
          </div>

          {/* RIDER & ROUTE DETAILS */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-2 text-xs">
            {/* Rider Identity */}
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xs">
                  {rider.name ? rider.name[0] : 'R'}
                </div>
                <div>
                  <span className="font-bold text-white block">{rider.name}</span>
                  <span className="text-[10px] text-gray-400">Verified NexRide Passenger</span>
                </div>
              </div>

              <span className="text-amber-400 font-black flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                <Star className="w-3 h-3 fill-amber-400" />
                {rider.rating || 4.95}
              </span>
            </div>

            {/* Pickup & Destination Addresses */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                <p className="text-gray-300 truncate font-semibold">
                  {ride.pickup?.address || 'Pickup Point'}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                <p className="text-gray-400 truncate text-[11px]">
                  {ride.destination?.address || 'Destination Point'}
                </p>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS (Min 44px Touch Targets) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setShowDeclineReasons(true)}
              className="touch-target py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Decline</span>
            </button>

            <button
              onClick={() => onAccept(request)}
              className="touch-target py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Accept ({timer}s)</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
