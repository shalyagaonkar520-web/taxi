import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Activity,
  DollarSign,
  Car,
  User,
  Users,
  TrendingUp,
  Sliders,
  RefreshCw,
  Zap,
  MapPin,
  Clock,
  Compass,
  Radio,
  BarChart3
} from 'lucide-react';
import { fetchAdminMetrics, updateAdminSettings, fetchUsers } from '../../services/api';
import { socket } from '../../services/socket';
import MapControls from './MapControls';
import DriverDrawer from './DriverDrawer';
import RiderDrawer from './RiderDrawer';

export default function AdminView({
  drivers = [],
  isConnected = true,
  onCenterMap,
  entityFilter = 'BOTH',
  onFilterChange,
  activeLayers = { cabs: true, riders: true, trips: true, surge: false },
  onLayerToggle,
  selectedDriver,
  onSelectDriver,
  selectedRider,
  onSelectRider,
  riders = [],
  setRiders
}) {
  const [metrics, setMetrics] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [activeRidesMap, setActiveRidesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [surge, setSurge] = useState(1.0);
  const [commission, setCommission] = useState(20);
  const [saveStatus, setSaveStatus] = useState('');
  const [activeTab, setActiveTab] = useState('OPERATIONS'); // 'OPERATIONS' | 'METRICS'

  // Load metrics and users
  const loadMetrics = async () => {
    try {
      setLoading(true);
      const [metricsData, usersData] = await Promise.all([
        fetchAdminMetrics(),
        fetchUsers().catch(() => [])
      ]);

      setMetrics(metricsData);
      if (usersData && Array.isArray(usersData)) {
        setAllUsers(usersData);
      }

      // Reconstruct active rides from recentRides snapshot
      if (metricsData?.recentRides) {
        const activeList = metricsData.recentRides.filter((r) =>
          ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)
        );
        setActiveRidesMap((prev) => {
          const updated = { ...prev };
          activeList.forEach((r) => {
            updated[r.id] = r;
          });
          return updated;
        });
      }

      if (metricsData?.settings) {
        setSurge(metricsData.settings.surgeMultiplier || 1.0);
        setCommission(metricsData.settings.platformCommissionPercent || 20);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const [sosAlert, setSosAlert] = useState(null);

  useEffect(() => {
    loadMetrics();

    // Listen to live ride events across all panels
    const handleRideEvent = (event) => {
      loadMetrics();
    };

    // Listen to settings changes saved by any admin
    const handleSettingsUpdated = (newSettings) => {
      if (newSettings) {
        if (newSettings.surgeMultiplier !== undefined) setSurge(newSettings.surgeMultiplier);
        if (newSettings.platformCommissionPercent !== undefined) setCommission(newSettings.platformCommissionPercent);
        loadMetrics();
      }
    };

    // Listen to driver status changes
    const handleDriverStatus = () => {
      loadMetrics();
    };

    // Listen to emergency SOS broadcasts
    const handleSosAlert = (data) => {
      setSosAlert(data);
      setTimeout(() => setSosAlert(null), 10000);
    };

    socket.on('admin:ride_event', handleRideEvent);
    socket.on('settings:updated', handleSettingsUpdated);
    socket.on('driver:status_changed', handleDriverStatus);
    socket.on('admin:sos_alert', handleSosAlert);

    return () => {
      socket.off('admin:ride_event', handleRideEvent);
      socket.off('settings:updated', handleSettingsUpdated);
      socket.off('driver:status_changed', handleDriverStatus);
      socket.off('admin:sos_alert', handleSosAlert);
    // Listen to live ride events
    const handleRideEvent = (event) => {
      const { type, ride } = event || {};
      if (ride && ride.id) {
        setActiveRidesMap((prev) => {
          const next = { ...prev };
          if (
            type === 'RIDE_COMPLETED' ||
            type === 'RIDE_CANCELLED' ||
            type === 'RIDE_NO_DRIVER' ||
            ride.status === 'COMPLETED' ||
            ride.status === 'CANCELLED'
          ) {
            delete next[ride.id];
          } else if (['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) {
            next[ride.id] = ride;
          }
          return next;
        });
      }
      loadMetrics();
    };

    socket.on('admin:ride_event', handleRideEvent);
    socket.on('settings:updated', (updated) => {
      if (updated.surgeMultiplier) setSurge(updated.surgeMultiplier);
      if (updated.platformCommissionPercent) setCommission(updated.platformCommissionPercent);
    });

    return () => {
      socket.off('admin:ride_event', handleRideEvent);
      socket.off('settings:updated');
    };
  }, []);

  // Compute active riders dynamically from active rides, registered users, and live driver GPS
  const derivedRiders = useMemo(() => {
    const list = [];
    Object.values(activeRidesMap).forEach((ride) => {
      if (!ride || !ride.riderId || !['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) {
        return;
      }

      const riderUser = (allUsers || []).find((u) => u.id === ride.riderId);
      const assignedDriver = ride.driverId
        ? drivers.find((d) => d.id === ride.driverId)
        : null;

      let loc = null;
      if (
        ride.status === 'IN_PROGRESS' &&
        assignedDriver?.location?.lat &&
        assignedDriver?.location?.lng
      ) {
        // In transit: rider is physically inside the assigned driver's car
        loc = {
          lat: assignedDriver.location.lat,
          lng: assignedDriver.location.lng,
          heading: assignedDriver.location.heading || 0
        };
      } else if (ride.pickup?.lat && ride.pickup?.lng) {
        // Requested, Accepted, or Arrived: rider is waiting at pickup location
        loc = {
          lat: parseFloat(ride.pickup.lat),
          lng: parseFloat(ride.pickup.lng)
        };
      }

      if (!loc) return;

      list.push({
        id: ride.riderId,
        name: riderUser?.name || 'Passenger',
        avatar: riderUser?.avatar,
        phone: riderUser?.phone,
        rating: riderUser?.rating || 4.9,
        walletBalance: riderUser?.walletBalance,
        totalRides: riderUser?.totalRides,
        activeRideId: ride.id,
        rideStatus: ride.status,
        pickup: ride.pickup,
        destination: ride.destination,
        category: ride.category,
        driverId: ride.driverId,
        assignedDriver: assignedDriver
          ? {
              id: assignedDriver.id,
              name: assignedDriver.name,
              rating: assignedDriver.rating,
              vehicle: assignedDriver.vehicle
            }
          : null,
        fare: ride.fare,
        paymentMethod: ride.paymentMethod,
        createdAt: ride.createdAt,
        location: loc
      });
    });
    return list;
  }, [activeRidesMap, allUsers, drivers]);

  // Sync derived active riders to parent state so LiveMap renders them
  useEffect(() => {
    if (setRiders) {
      setRiders(derivedRiders);
    }
  }, [derivedRiders, setRiders]);

  // Keep selected rider in sync with live coordinates and status
  useEffect(() => {
    if (selectedRider) {
      const updated = derivedRiders.find((r) => r.id === selectedRider.id);
      if (updated) {
        onSelectRider(updated);
      }
    }
  }, [derivedRiders]);

  // Update Settings
  const handleSaveSettings = async () => {
    try {
      setSaveStatus('Saving...');
      await updateAdminSettings({
        surgeMultiplier: parseFloat(surge),
        platformCommissionPercent: parseInt(commission, 10)
      });
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      setSaveStatus('Error saving');
    }
  };

  // Find active trip for selected driver
  const selectedDriverTrip = selectedDriver
    ? metrics?.recentRides?.find(
        (r) =>
          r.driverId === selectedDriver.id &&
          ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)
      )
    : null;

  // Find active trip for selected rider
  const selectedRiderTrip = selectedRider
    ? activeRidesMap[selectedRider.activeRideId] ||
      metrics?.recentRides?.find(
        (r) =>
          r.riderId === selectedRider.id &&
          ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)
      )
    : null;

  const onlineDriversCount = drivers.filter((d) => d.status === 'ONLINE').length;
  const busyDriversCount = drivers.filter((d) => d.status === 'BUSY').length;
  const offlineDriversCount = drivers.filter((d) => d.status === 'OFFLINE').length;
  const ridersWithCoordsCount = derivedRiders.length;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* SOS EMERGENCY DISPATCH ALERT BANNER */}
      {sosAlert && (
        <div className="p-4 rounded-3xl bg-red-500/20 border-2 border-red-500/80 text-white flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <h4 className="text-sm font-black text-red-300">EMERGENCY SOS BROADCAST</h4>
              <p className="text-xs text-white">Ride ID: {sosAlert.rideId} • {sosAlert.note || 'Emergency assistance requested'}</p>
            </div>
          </div>
          <button onClick={() => setSosAlert(null)} className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white">
            Acknowledge
          </button>
        </div>
      )}

      {/* ADMIN SYNC STATUS BADGE */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-gray-300">Connected to Dispatch Engine • All Admins Synced</span>
        </div>
        <span className="text-[11px] font-mono text-gray-500">Auto-refresh on live ride & settings events</span>
      </div>

      {/* 1. METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gross Revenue */}
        <div className="glass-card p-5 rounded-3xl border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gross Volume</span>
            <div className="w-8 h-8 rounded-xl bg-uber-green/20 text-uber-green flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            ${metrics?.totalRevenue || '342.80'}
          </p>
          <span className="text-[11px] text-uber-green font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +18.4% today
          </span>
        </div>
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Top Operations / Analytics Mode Switcher */}
      <div className="p-1 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center gap-1 shadow-lg">
        <button
          onClick={() => setActiveTab('OPERATIONS')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'OPERATIONS'
              ? 'bg-uber-accent text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Live Operations</span>
        </button>

        <button
          onClick={() => setActiveTab('METRICS')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'METRICS'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Analytics & Settings</span>
        </button>
      </div>

      {/* VIEW A: LIVE OPERATIONS CENTER */}
      {activeTab === 'OPERATIONS' && (
        <div className="flex flex-col gap-4">
          {/* Map Controls Toolbar */}
          <MapControls
            entityFilter={entityFilter}
            onFilterChange={onFilterChange}
            activeLayers={activeLayers}
            onLayerToggle={onLayerToggle}
            onSelectLocation={(loc) => {
              if (onCenterMap) onCenterMap([loc.lat, loc.lng]);
            }}
            isConnected={isConnected}
            cabsCount={onlineDriversCount + busyDriversCount}
            ridersWithCoordsCount={ridersWithCoordsCount}
          />

          {/* Quick Fleet Telemetry Monitor Cards */}
          <div className="bg-[#121216]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-uber-accent" /> Fleet Monitor ({drivers.length})
              </span>
              <div className="flex items-center gap-2 text-[10px] font-semibold">
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {onlineDriversCount} Online
                </span>
                {busyDriversCount > 0 && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {busyDriversCount} Busy
                  </span>
                )}
                {offlineDriversCount > 0 && (
                  <span className="text-zinc-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> {offlineDriversCount} Off
                  </span>
                )}
              </div>
            </div>

            {/* Compact Driver Quick Select Chips */}
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
              {drivers.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">No drivers registered</p>
              ) : (
                drivers.map((driver) => {
                  const isSelected = selectedDriver?.id === driver.id;
                  const isBusy = driver.status === 'BUSY';
                  const isOnline = driver.status === 'ONLINE';

                  return (
                    <button
                      key={driver.id}
                      onClick={() => {
                        onSelectDriver(driver);
                        if (driver.location && onCenterMap) {
                          onCenterMap([driver.location.lat, driver.location.lng]);
                        }
                      }}
                      className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between text-xs transition-all ${
                        isSelected
                          ? 'bg-uber-accent/20 border-uber-accent/50 text-white'
                          : 'bg-black/40 border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isBusy ? 'bg-amber-400 animate-pulse' : isOnline ? 'bg-emerald-400' : 'bg-zinc-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate text-xs">{driver.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {driver.vehicle?.make} {driver.vehicle?.model} • {driver.vehicle?.category || 'UberX'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isBusy
                              ? 'bg-amber-500/20 text-amber-400'
                              : isOnline
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-700/30 text-zinc-400'
                          }`}
                        >
                          {driver.status || 'ONLINE'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Rider Dispatches Monitor Card */}
          <div className="bg-[#121216]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-400" /> Active Dispatches ({derivedRiders.length})
              </span>
              <span className="text-[10px] text-gray-400 font-semibold">
                {derivedRiders.length === 0 ? 'No active trips' : 'Live tracking'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
              {derivedRiders.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-3">
                  No active riders currently requesting or taking a trip
                </p>
              ) : (
                derivedRiders.map((activeRider) => {
                  const isSelected = selectedRider?.id === activeRider.id;
                  const status = activeRider.rideStatus;
                  const isTransit = status === 'IN_PROGRESS';
                  const isArrived = status === 'ARRIVED';
                  const isAccepted = status === 'ACCEPTED';

                  const badgeClass = isTransit
                    ? 'bg-purple-500/20 text-purple-300'
                    : isArrived
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isAccepted
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-amber-500/20 text-amber-300';

                  const badgeText = isTransit
                    ? 'ON TRIP'
                    : isArrived
                    ? 'ARRIVED'
                    : isAccepted
                    ? 'EN ROUTE'
                    : 'MATCHING';

                  return (
                    <button
                      key={activeRider.id}
                      onClick={() => {
                        onSelectRider(activeRider);
                        if (activeRider.location && onCenterMap) {
                          onCenterMap([activeRider.location.lat, activeRider.location.lng]);
                        }
                      }}
                      className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between text-xs transition-all ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500/50 text-white'
                          : 'bg-black/40 border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isTransit
                              ? 'bg-purple-400 animate-pulse'
                              : isArrived
                              ? 'bg-emerald-400'
                              : isAccepted
                              ? 'bg-blue-400 animate-pulse'
                              : 'bg-amber-400 animate-pulse'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate text-xs">{activeRider.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {activeRider.category || 'Ride'} • {activeRider.pickup?.address?.split(',')[0] || 'Pickup'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: FULL METRICS, SURGE PRICING & DISPATCH LOGS (100% PRESERVED) */}
      {activeTab === 'METRICS' && (
        <div className="flex flex-col gap-6">
          {/* 1. METRICS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Gross Revenue */}
            <div className="glass-card p-5 rounded-3xl border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gross Volume</span>
                <div className="w-8 h-8 rounded-xl bg-uber-green/20 text-uber-green flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white">
                ${metrics?.totalRevenue !== undefined ? metrics.totalRevenue : '342.80'}
              </p>
              <span className="text-[11px] text-uber-green font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> +18.4% today
              </span>
            </div>

            {/* Platform Commission (Net) */}
            <div className="glass-card p-5 rounded-3xl border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Platform Take (20%)</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-purple-300">
                ${metrics?.platformRevenue !== undefined ? metrics.platformRevenue : '68.56'}
              </p>
              <span className="text-[11px] text-gray-400 font-semibold">
                Net dispatch earnings
              </span>
            </div>

            {/* Active Trips */}
            <div className="glass-card p-5 rounded-3xl border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Trips</span>
                <div className="w-8 h-8 rounded-xl bg-uber-accent/20 text-uber-accent flex items-center justify-center">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white">
                {metrics?.activeRides || 0}
              </p>
              <span className="text-[11px] text-uber-accent font-semibold">
                Live on city map
              </span>
            </div>

            {/* Online Drivers */}
            <div className="glass-card p-5 rounded-3xl border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Online Fleet</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white">
                {onlineDriversCount} / {drivers.length}
              </p>
              <span className="text-[11px] text-gray-400 font-semibold">
                {busyDriversCount} currently on trips
              </span>
            </div>
          </div>

          {/* 2. DYNAMIC SURGE PRICING & DISPATCH ENGINE CONTROLS */}
          <div className="glass-card p-6 rounded-3xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-uber-accent" />
                <h3 className="text-base font-extrabold text-white">Dynamic Pricing & Surge Dispatch Controls</h3>
              </div>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-xl bg-uber-accent hover:bg-uber-accentHover text-white text-xs font-bold shadow-md transition-all"
              >
                {saveStatus || 'Apply Settings'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Surge Multiplier Slider */}
              <div className="flex flex-col gap-2 bg-black/40 p-4 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-300 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-uber-gold" /> Surge Multiplier:
                  </span>
                  <span className="text-uber-gold font-extrabold text-sm">{surge}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.1"
                  value={surge}
                  onChange={(e) => setSurge(e.target.value)}
                  className="w-full accent-uber-accent cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-semibold mt-1">
                  <span>1.0x (Normal)</span>
                  <span>2.0x (High Demand)</span>
                  <span>3.5x (Peak Surge)</span>
                </div>
              </div>

              {/* Platform Commission Rate */}
              <div className="flex flex-col gap-2 bg-black/40 p-4 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-300">Platform Commission:</span>
                  <span className="text-purple-400 font-extrabold text-sm">{commission}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  step="1"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className="w-full accent-purple-600 cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-semibold mt-1">
                  <span>10% (Low)</span>
                  <span>20% (Standard)</span>
                  <span>30% (High)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. RECENT DISPATCH TRIP LOGS */}
          <div className="glass-card p-6 rounded-3xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <h3 className="text-base font-extrabold text-white">Live Platform Trip Logs</h3>
              </div>
              <button
                onClick={loadMetrics}
                className="flex items-center gap-1.5 text-xs text-uber-accent hover:underline font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {!metrics?.recentRides || metrics.recentRides.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-6">No rides logged yet</p>
              ) : (
                metrics.recentRides.map((ride) => (
                  <div
                    key={ride.id}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-white font-bold">
                        {ride.category === 'UberBlack' ? '⬛' : '🚗'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{ride.category}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ride.status === 'COMPLETED'
                                ? 'bg-uber-green/20 text-uber-green'
                                : ride.status === 'IN_PROGRESS'
                                ? 'bg-uber-accent/20 text-uber-accent animate-pulse'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {ride.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate max-w-sm mt-0.5">
                          {ride.pickup?.address?.split(',')[0]} → {ride.destination?.address?.split(',')[0]}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-extrabold text-white">${ride.fare}</p>
                      <p className="text-[10px] text-gray-500 font-semibold">
                        {new Date(ride.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Driver Details Drawer (Opens when driver marker or card is clicked) */}
      {selectedDriver && (
        <DriverDrawer
          driver={selectedDriver}
          activeTrip={selectedDriverTrip}
          onClose={() => onSelectDriver(null)}
          onCenterMap={onCenterMap}
        />
      )}

      {/* Floating Rider Details Drawer (Opens when rider is selected) */}
      {selectedRider && (
        <RiderDrawer
          rider={selectedRider}
          activeTrip={selectedRiderTrip}
          onClose={() => onSelectRider(null)}
          onCenterMap={onCenterMap}
        />
      )}
    </div>
  );
}
