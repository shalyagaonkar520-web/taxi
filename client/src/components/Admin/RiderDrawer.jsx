import React from 'react';
import {
  X,
  User,
  Star,
  Wallet,
  AlertCircle,
  MapPin,
  Clock,
  Car,
  DollarSign,
  Navigation,
  Shield,
  Activity
} from 'lucide-react';

export default function RiderDrawer({ rider, activeTrip, onClose, onCenterMap }) {
  if (!rider) return null;

  const trip = activeTrip || (rider.activeRideId ? rider : null);
  const status = trip?.rideStatus || trip?.status || 'REQUESTED';

  const statusBadge = {
    REQUESTED: {
      text: 'MATCHING / REQUESTED',
      badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-400'
    },
    ACCEPTED: {
      text: 'DRIVER DISPATCHED',
      badgeClass: 'bg-blue-500/15 border-blue-500/30 text-blue-400'
    },
    ARRIVED: {
      text: 'DRIVER ARRIVED AT PICKUP',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
    },
    IN_PROGRESS: {
      text: 'IN TRANSIT (ON TRIP)',
      badgeClass: 'bg-purple-500/20 border-purple-500/40 text-purple-300'
    }
  }[status] || {
    text: status,
    badgeClass: 'bg-zinc-700/30 border-zinc-600/30 text-zinc-400'
  };

  const centerTarget =
    rider.location?.lat && rider.location?.lng
      ? [rider.location.lat, rider.location.lng]
      : trip?.pickup?.lat && trip?.pickup?.lng
      ? [parseFloat(trip.pickup.lat), parseFloat(trip.pickup.lng)]
      : null;

  return (
    <aside
      aria-label="Rider Details"
      className="fixed top-20 right-4 bottom-4 z-40 w-full max-w-sm rounded-3xl border border-white/10 bg-[#121216]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-white animate-in slide-in-from-right duration-200 pointer-events-auto"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-purple-400" />
          <span className="text-xs uppercase tracking-wider font-bold text-gray-400">
            Rider Telemetry
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          title="Close Details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Rider Profile Summary */}
        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div className="relative">
            {rider.avatar ? (
              <img
                src={rider.avatar}
                alt={rider.name}
                className="w-14 h-14 rounded-2xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-lg font-black text-purple-200">
                {rider.name ? rider.name[0] : 'R'}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#121216] bg-purple-500" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-base text-white truncate">{rider.name}</h3>
            <p className="text-xs text-gray-400 font-mono tracking-wide mt-0.5">{rider.id}</p>
            {rider.phone && (
              <p className="text-[11px] text-zinc-400 mt-1">{rider.phone}</p>
            )}
            {trip && (
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${statusBadge.badgeClass}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {statusBadge.text}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Operational Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-black/40 border border-white/5 p-3 rounded-2xl">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Rating</span>
            <div className="flex items-center justify-center gap-1 mt-1 text-amber-400 font-extrabold text-sm">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{rider.rating || '5.0'}</span>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-2xl">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Trips</span>
            <p className="mt-1 text-white font-extrabold text-sm">
              {rider.totalRides || 0}
            </p>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-2xl">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Balance</span>
            <p className="mt-1 text-emerald-400 font-extrabold text-sm">
              ${rider.walletBalance !== undefined ? Number(rider.walletBalance).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>

        {/* Active Dispatch & Trip Information */}
        {trip ? (
          <div className="bg-purple-950/30 border border-purple-500/30 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-pulse text-purple-400" />
                Active Trip Session
              </span>
              <span className="text-[10px] font-mono text-zinc-300 bg-white/10 px-2 py-0.5 rounded border border-white/5">
                {trip.activeRideId || trip.id}
              </span>
            </div>

            {/* Vehicle Tier */}
            {trip.category && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-gray-400 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-uber-accent" /> Vehicle Tier:
                </span>
                <span className="font-bold text-white uppercase">{trip.category}</span>
              </div>
            )}

            {/* Pickup & Destination */}
            <div className="text-xs flex flex-col gap-2 pt-1 border-t border-white/5">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-uber-accent shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Pickup Location</span>
                  <p className="text-white truncate font-medium">
                    {trip.pickup?.address || 'Pickup Point'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Destination</span>
                  <p className="text-white truncate font-medium">
                    {trip.destination?.address || 'Destination Point'}
                  </p>
                </div>
              </div>
            </div>

            {/* Assigned Driver (if accepted or in progress) */}
            {trip.assignedDriver && (
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs mt-1">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Assigned Driver</span>
                  <p className="font-bold text-white">{trip.assignedDriver.name}</p>
                  {trip.assignedDriver.vehicle && (
                    <p className="text-[10px] text-gray-400">
                      {trip.assignedDriver.vehicle.make} {trip.assignedDriver.vehicle.model}
                      {trip.assignedDriver.vehicle.licensePlate && ` (${trip.assignedDriver.vehicle.licensePlate})`}
                    </p>
                  )}
                </div>
                {trip.assignedDriver.rating && (
                  <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{trip.assignedDriver.rating}</span>
                  </div>
                )}
              </div>
            )}

            {/* Fare & Payment */}
            {(trip.fare !== undefined || trip.paymentMethod) && (
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                <div className="flex items-center gap-1 text-gray-400">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Payment: {trip.paymentMethod || 'WALLET'}</span>
                </div>
                {trip.fare !== undefined && (
                  <span className="font-extrabold text-emerald-400 text-sm">
                    ${Number(trip.fare).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center text-xs text-gray-400">
            No active dispatch or trip in progress
          </div>
        )}

        {/* Telemetry Status Notice */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-purple-400 font-bold">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Telemetry Policy</span>
          </div>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            {status === 'IN_PROGRESS'
              ? 'Rider is currently in transit inside assigned vehicle. Map marker tracks driver live telemetry.'
              : 'Rider coordinates are derived from active dispatch pickup points. Idle riders without active trips are not tracked via background GPS.'}
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 flex items-center gap-2 bg-[#121216]">
        {centerTarget && onCenterMap && (
          <button
            onClick={() => onCenterMap(centerTarget)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Navigation className="w-3.5 h-3.5" /> Center on Map
          </button>
        )}
        <button
          onClick={onClose}
          className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
        >
          Close
        </button>
      </div>
    </aside>
  );
}
