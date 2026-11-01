import React from 'react';
import {
  X,
  Star,
  Car,
  Compass,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  DollarSign,
  Shield,
  Activity
} from 'lucide-react';

export default function DriverDrawer({ driver, activeTrip, onClose, onCenterMap }) {
  if (!driver) return null;

  const isOnline = driver.status === 'ONLINE';
  const isBusy = driver.status === 'BUSY';
  const statusLabel = isBusy ? 'BUSY (ON TRIP)' : isOnline ? 'ONLINE & AVAILABLE' : 'OFFLINE';

  const statusBadgeClass = isBusy
    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
    : isOnline
    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
    : 'bg-zinc-700/30 border-zinc-600/30 text-zinc-400';

  return (
    <aside
      aria-label="Driver Details"
      className="fixed top-20 right-4 bottom-4 z-40 w-full max-w-sm rounded-3xl border border-white/10 bg-[#121216]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-white animate-in slide-in-from-right duration-200 pointer-events-auto"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-uber-accent" />
          <span className="text-xs uppercase tracking-wider font-bold text-gray-400">
            Fleet Telemetry
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
        {/* Driver Profile Summary */}
        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div className="relative">
            {driver.avatar ? (
              <img
                src={driver.avatar}
                alt={driver.name}
                className="w-14 h-14 rounded-2xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-lg font-black text-white">
                {driver.name ? driver.name[0] : 'D'}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#121216] ${
                isBusy ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-zinc-500'
              }`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-base text-white truncate">{driver.name}</h3>
            <p className="text-xs text-gray-400 font-mono tracking-wide mt-0.5">{driver.id}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${statusBadgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-amber-400 animate-pulse' : isOnline ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Operational Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-black/40 border border-white/5 p-3 rounded-2xl">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Rating</span>
            <div className="flex items-center justify-center gap-1 mt-1 text-amber-400 font-extrabold text-sm">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{driver.rating || '5.0'}</span>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-2xl">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Trips</span>
            <p className="mt-1 text-white font-extrabold text-sm">
              {driver.totalTrips ? driver.totalTrips.toLocaleString() : '0'}
            </p>
          </div>

          <div className="bg-black/40 border border-white/5 p-3 rounded-2xl">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Acceptance</span>
            <p className="mt-1 text-emerald-400 font-extrabold text-sm">
              {driver.acceptanceRate ? `${driver.acceptanceRate}%` : '100%'}
            </p>
          </div>
        </div>

        {/* Assigned Vehicle */}
        {driver.vehicle && (
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-uber-accent" /> Assigned Vehicle
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-white uppercase tracking-wider">
                {driver.vehicle.category || 'UberX'}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {driver.vehicle.make} {driver.vehicle.model}
                {driver.vehicle.year ? ` (${driver.vehicle.year})` : ''}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                {driver.vehicle.color && <span>Color: {driver.vehicle.color}</span>}
                {driver.vehicle.licensePlate && (
                  <span className="font-mono bg-zinc-800 text-amber-300 px-2 py-0.5 rounded border border-white/10 text-[11px] font-semibold">
                    {driver.vehicle.licensePlate}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GPS Live Telemetry */}
        {driver.location && (
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-purple-400" /> GPS Coordinates
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                Heading: {Math.round(driver.location.heading || 0)}°
              </span>
            </div>
            <p className="font-mono text-xs text-zinc-300 bg-zinc-900/80 p-2 rounded-xl border border-white/5">
              Lat: {driver.location.lat.toFixed(6)}, Lng: {driver.location.lng.toFixed(6)}
            </p>
          </div>
        )}

        {/* Current Trip Section */}
        {activeTrip ? (
          <div className="bg-uber-accent/10 border border-uber-accent/30 p-4 rounded-2xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-uber-accent flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-pulse" /> Active Trip
              </span>
              <span className="text-[10px] font-mono text-zinc-300 bg-white/10 px-2 py-0.5 rounded">
                {activeTrip.id}
              </span>
            </div>
            <div className="text-xs flex flex-col gap-1 text-zinc-300">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-uber-accent shrink-0 mt-0.5" />
                <span className="truncate">{activeTrip.pickup?.address || 'Pickup point'}</span>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="truncate">{activeTrip.destination?.address || 'Destination point'}</span>
              </div>
            </div>
            {activeTrip.fare && (
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                <span className="text-gray-400">Fare</span>
                <span className="font-bold text-emerald-400">${activeTrip.fare}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center text-xs text-gray-400">
            No dispatch trip currently assigned
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 flex items-center gap-2 bg-[#121216]">
        {driver.location && onCenterMap && (
          <button
            onClick={() => onCenterMap([driver.location.lat, driver.location.lng])}
            className="flex-1 py-2.5 px-3 rounded-xl bg-uber-accent hover:bg-uber-accentHover text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
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
