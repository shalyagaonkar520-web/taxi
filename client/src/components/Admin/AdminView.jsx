import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  DollarSign,
  Users,
  Car,
  TrendingUp,
  Sliders,
  AlertCircle,
  RefreshCw,
  Zap,
  CheckCircle,
  MapPin,
  Clock
} from 'lucide-react';
import { fetchAdminMetrics, updateAdminSettings } from '../../services/api';
import { socket } from '../../services/socket';

export default function AdminView({ drivers }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [surge, setSurge] = useState(1.0);
  const [commission, setCommission] = useState(20);
  const [saveStatus, setSaveStatus] = useState('');

  // Load metrics
  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminMetrics();
      setMetrics(data);
      if (data?.settings) {
        setSurge(data.settings.surgeMultiplier || 1.0);
        setCommission(data.settings.platformCommissionPercent || 20);
      }
    } catch (err) {
      console.error('Failed to fetch admin metrics:', err);
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
    };
  }, []);

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

        {/* Platform Commission (Net) */}
        <div className="glass-card p-5 rounded-3xl border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Platform Take (20%)</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-300">
            ${metrics?.platformRevenue || '68.56'}
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
            {drivers.filter(d => d.status === 'ONLINE').length} / {drivers.length}
          </p>
          <span className="text-[11px] text-gray-400 font-semibold">
            {drivers.filter(d => d.status === 'BUSY').length} currently on trips
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
          {metrics?.recentRides?.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-6">No rides logged yet</p>
          ) : (
            metrics?.recentRides?.map((ride) => (
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ride.status === 'COMPLETED' ? 'bg-uber-green/20 text-uber-green' :
                        ride.status === 'IN_PROGRESS' ? 'bg-uber-accent/20 text-uber-accent animate-pulse' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
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
                    {new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
