import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Power, 
  Clock, 
  MapPin, 
  Navigation, 
  Check, 
  X, 
  Zap, 
  Sliders, 
  AlertTriangle, 
  ChevronRight, 
  Shield, 
  Search, 
  Flame, 
  Radio,
  Play,
  ArrowUpDown,
  Compass,
  TrendingUp,
  Award
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function DriverHomeTab({
  driver,
  isOnline,
  onToggleOnline,
  sessionSeconds = 0,
  summaryData = null,
  showHeatmap = false,
  onToggleHeatmap,
  heatmapZones = [],
  destinationMode = null,
  onUpdateDestination,
  autoAccept = false,
  onToggleAutoAccept,
  currentLanguage = 'kn',
  onOpenSOS,
  onOpenPreferences,
  incomingRequest = null,
  onAcceptRide,
  onDeclineRide
}) {
  const isKannada = currentLanguage === 'kn';

  // Format seconds into HH:MM:SS
  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const today = summaryData?.today || {
    earnings: driver?.earningsToday || 184,
    trips: 8,
    onlineHours: (sessionSeconds / 3600).toFixed(1),
    acceptanceRate: driver?.acceptanceRate || 98
  };

  // Mock Available Rides Feed matching Screenshot 5
  const [availableRides, setAvailableRides] = useState([
    {
      id: 'ride-req-01',
      vehicleType: 'Auto',
      paymentMode: 'Cash',
      fare: 65,
      ratePerKm: 24,
      pickupDistance: '1.6 km',
      pickupDuration: '7 mins',
      pickupAddress: 'MPN Altius, Subramanya Pura Road Padmanabhanagar Bengaluru Karnataka India',
      dropDistance: '2.7 km',
      dropDuration: '11 mins',
      dropAddress: 'ಕನಕಪುರ ರೋಡ್ (Kanakapura Road)',
      secondsRemaining: 15
    },
    {
      id: 'ride-req-02',
      vehicleType: 'Auto',
      paymentMode: 'Cash',
      fare: 78,
      ratePerKm: 22,
      pickupDistance: '1.6 km',
      pickupDuration: '7 mins',
      pickupAddress: 'JP Nagar 6th Phase Side, Jayaprakash Nagar Metro Station',
      dropDistance: '3.5 km',
      dropDuration: '15 mins',
      dropAddress: 'ಬ್ರಿಗೇಡ್ ಗಾರ್ಡನಿಯಾ (Brigade Gardenia)',
      secondsRemaining: 24
    },
    {
      id: 'ride-req-03',
      vehicleType: 'Auto',
      paymentMode: 'Cash',
      fare: 65,
      ratePerKm: 24,
      pickupDistance: '2.0 km',
      pickupDuration: '8 mins',
      pickupAddress: 'Banashankari 2nd Stage, BDA Complex',
      dropDistance: '3.1 km',
      dropDuration: '12 mins',
      dropAddress: 'ಉತ್ತರಹಳ್ಳಿ ಮುಖ್ಯ ರಸ್ತೆ (Uttarahalli Main Rd)',
      secondsRemaining: 30
    }
  ]);

  const [sortOrder, setSortOrder] = useState('old_to_new'); // 'old_to_new' | 'fare_high'
  const [showPromoModal, setShowPromoModal] = useState(false);

  // Active ride countdown timers
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      setAvailableRides((prev) => {
        const updated = prev
          .map((r) => ({ ...r, secondsRemaining: r.secondsRemaining - 1 }))
          .filter((r) => r.secondsRemaining > 0);
        
        // If empty, auto-replenish with fresh requests after 4s so driver always has rides to test
        if (updated.length === 0) {
          return [
            {
              id: `ride-req-${Date.now()}-1`,
              vehicleType: 'Auto',
              paymentMode: 'Cash',
              fare: 65,
              ratePerKm: 24,
              pickupDistance: '1.6 km',
              pickupDuration: '7 mins',
              pickupAddress: 'MPN Altius, Subramanya Pura Road Padmanabhanagar Bengaluru Karnataka India',
              dropDistance: '2.7 km',
              dropDuration: '11 mins',
              dropAddress: 'ಕನಕಪುರ ರೋಡ್ (Kanakapura Road)',
              secondsRemaining: 25
            },
            {
              id: `ride-req-${Date.now()}-2`,
              vehicleType: 'Auto',
              paymentMode: 'Cash',
              fare: 78,
              ratePerKm: 22,
              pickupDistance: '1.6 km',
              pickupDuration: '7 mins',
              pickupAddress: 'JP Nagar 6th Phase Side, Jayaprakash Nagar Metro Station',
              dropDistance: '3.5 km',
              dropDuration: '15 mins',
              dropAddress: 'ಬ್ರಿಗೇಡ್ ಗಾರ್ಡನಿಯಾ (Brigade Gardenia)',
              secondsRemaining: 30
            }
          ];
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleDeclineSingleRide = (rideId) => {
    setAvailableRides(prev => prev.filter(r => r.id !== rideId));
    try { sound.playBell(); } catch (e) {}
  };

  const handleAcceptSingleRide = (r) => {
    // If there's an active socket ride callback
    if (onAcceptRide) {
      onAcceptRide({
        ride: {
          id: r.id,
          pickup: r.pickupAddress,
          destination: r.dropAddress,
          fare: r.fare,
          distanceKm: 3.2,
          status: 'ACCEPTED',
          driverId: driver?.id || 'driver-01',
          riderId: 'rider-01',
          riderName: 'Priya Sharma',
          riderRating: 4.9,
          otp: '4928'
        }
      });
    }
  };

  // Real Leaflet Map Hook & References
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const heatmapLayerRef = useRef([]);

  const driverLat = driver?.location?.lat || 12.9141;
  const driverLng = driver?.location?.lng || 77.5753;

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize real Leaflet map
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([driverLat, driverLng], 14);

    // High-quality OpenStreetMap clean tile provider
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    // Zoom controls at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Driver Marker Icon with vehicle heading & license plate
    const iconHtml = `
      <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="width: 42px; height: 42px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(37,99,235,0.6);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
        <span style="margin-top: 3px; background: rgba(0,0,0,0.85); color: #ffffff; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3); white-space: nowrap; font-family: monospace;">
          ${driver?.vehicle?.licensePlate || 'KA-01-EQ-7892'}
        </span>
      </div>
    `;

    const marker = L.marker([driverLat, driverLng], {
      icon: L.divIcon({
        html: iconHtml,
        className: 'driver-live-map-marker',
        iconSize: [42, 58],
        iconAnchor: [21, 29]
      })
    }).addTo(map);
    driverMarkerRef.current = marker;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync heatmap zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    heatmapLayerRef.current.forEach((l) => map.removeLayer(l));
    heatmapLayerRef.current = [];

    if (showHeatmap && heatmapZones?.length > 0) {
      heatmapZones.forEach((zone) => {
        const circle = L.circle([zone.lat, zone.lng], {
          radius: zone.radiusMeters || 1200,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.25,
          weight: 2
        }).addTo(map);
        heatmapLayerRef.current.push(circle);
      });
    }
  }, [showHeatmap, heatmapZones]);

  // Recenter map helper
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([driverLat, driverLng], 14, { duration: 1.2 });
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-28 w-full max-w-md mx-auto text-white animate-in fade-in">
      
      {/* 1. TOP SEGMENTED SWITCH & TELEMETRY BAR (Screenshot 10) */}
      <div className="flex items-center justify-between gap-2 pt-1 px-1">
        
        {/* Offline / Online Segmented pill switch */}
        <div className="flex items-center p-1 rounded-full bg-white/10 border border-white/10">
          <button
            onClick={() => { if (isOnline) onToggleOnline(); }}
            className={`touch-target px-4 py-1 rounded-full text-xs font-black transition-all ${
              !isOnline 
                ? 'bg-red-500 text-white shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {isKannada ? 'ಆಫ್‌ಲೈನ್' : 'Offline'}
          </button>
          <button
            onClick={() => { if (!isOnline) onToggleOnline(); }}
            className={`touch-target px-4 py-1 rounded-full text-xs font-black transition-all ${
              isOnline 
                ? 'bg-emerald-500 text-black shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {isKannada ? 'ಆನ್‌ಲೈನ್' : 'Online'}
          </button>
        </div>

        {/* Top Action Icons: Safety (SOS) & Preferences */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSOS}
            className="touch-target p-2 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all shadow-sm"
            title="SOS Emergency"
          >
            <Shield className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenPreferences}
            className="touch-target p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-gray-200 transition-all shadow-sm"
            title="Preferences"
          >
            <Sliders className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* 2. SUMMARY TELEMETRY BAR (Screenshot 10: "ಸವಾರಿಗಳು ಇಲ್ಲ • ₹0 • -155") */}
      <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">{isKannada ? 'ಸವಾರಿಗಳು' : 'Trips'}:</span>
          <span className="text-white font-black">{isOnline ? today.trips : (isKannada ? 'ಇಲ್ಲ' : '0')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">{isKannada ? 'ಇಂದಿನ ಗಳಿಕೆ' : 'Earnings'}:</span>
          <span className="text-emerald-400 font-black">₹{isOnline ? today.earnings : 0}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-amber-500 text-[10px] text-black font-black flex items-center justify-center">₹</span>
          <span className="text-gray-300 font-mono">-155</span>
        </div>
      </div>

      {/* 3. WHEN OFFLINE: BIG BOLD HEADER & MAP CARD (Screenshots 3 & 10) */}
      {!isOnline ? (
        <div className="flex flex-col gap-4">
          
          {/* Big Bold Headline */}
          <div className="pt-2 px-1">
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
              {isKannada ? 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ' : 'You are Offline'}
            </h1>
            <p className="text-sm font-semibold text-gray-400 mt-1">
              {isKannada ? 'ಹೊರಡಲು ಸಿದ್ಧರಿದ್ದೀರಾ?' : 'Ready to head out for trips?'}
            </p>
          </div>

          {/* Real Interactive Leaflet Map Container */}
          <div className="relative rounded-3xl overflow-hidden h-60 border border-white/15 shadow-2xl bg-[#0e1626]">
            {/* The Real Interactive Leaflet Map */}
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Bengaluru South Location Pill */}
            <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-xs font-bold text-white flex items-center gap-1.5 pointer-events-none shadow-md">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Bengaluru South</span>
            </div>

            {/* Floating Map Controls */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
              <button 
                onClick={onToggleHeatmap}
                className={`touch-target p-2 rounded-xl backdrop-blur-md border transition-all shadow-md ${
                  showHeatmap ? 'bg-amber-500 text-black border-amber-400 font-bold' : 'bg-black/70 text-white border-white/15 hover:bg-black/90'
                }`}
                title="Demand Heatmap"
              >
                <Flame className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRecenter}
                className="touch-target p-2 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white transition-all shadow-md"
                title="Recenter Map"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 0% Commission 24-Hour Pass Card (Screenshot 3) */}
          <div className="glass-card p-4 rounded-3xl border border-white/10 flex items-center justify-between bg-[#14141c]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  0% Commission
                </span>
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {isKannada ? 'ಆಕ್ಟಿವ್' : 'Active'}
                </span>
              </div>
              <h3 className="text-sm font-black text-white mt-0.5">
                {isKannada ? 'ಅನಿಯಮಿತ ಪಾಸ್ • 24 ಗಂಟೆ' : 'Unlimited Pass • 24 Hours'}
              </h3>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </div>

          {/* TWO AUTHENTIC ONLINE ACTION CONTROLS: */}
          {/* 1. Iconic Floating Green Circular "ಹೋಗಿ!" (GO!) Button (Screenshot 10) */}
          <div className="flex flex-col items-center justify-center my-2 gap-2">
            <button
              onClick={onToggleOnline}
              className="touch-target w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black text-2xl shadow-2xl shadow-emerald-500/40 border-4 border-white/90 active:scale-95 transition-all flex items-center justify-center relative group"
            >
              <span className="relative z-10">{isKannada ? 'ಹೋಗಿ!' : 'GO!'}</span>
              <span className="absolute inset-0 rounded-full border-4 border-emerald-400 opacity-60 animate-ping pointer-events-none" />
            </button>
            <span className="text-xs font-bold text-gray-300">
              {isKannada ? 'ಆನ್‌ಲೈನ್‌ಗೆ ಹೋಗಲು ಟ್ಯಾಪ್ ಮಾಡಿ' : 'Tap to go online'}
            </span>
          </div>

          {/* 2. Prominent Blue Pill Button (Screenshot 3) */}
          <button
            onClick={onToggleOnline}
            className="touch-target w-full py-4 rounded-3xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 active:scale-98"
          >
            <Navigation className="w-5 h-5 rotate-45 stroke-[2.5]" />
            <span>{isKannada ? 'ಆನ್‌ಲೈನ್‌ಗೆ ಹೋಗಿ' : 'Go Online'}</span>
          </button>

          {/* Government Meter Cab Promotional Banner (Screenshot 10) */}
          <div className="p-3.5 rounded-3xl bg-[#12121a] border border-white/10 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-black">
                  20% EXTRA
                </span>
                <span className="text-[11px] font-bold text-gray-300">Govt Rates</span>
              </div>
              <p className="text-xs font-black text-white mt-1 leading-snug">
                {isKannada ? 'ಮೀಟರ್ ಕ್ಯಾಬ್. ಸರ್ಕಾರ ರೇಟ್ಸ್.' : 'Meter Cab. Government Rates.'}
              </p>
            </div>
            <button
              onClick={() => setShowPromoModal(true)}
              className="touch-target px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Watch</span>
            </button>
          </div>

        </div>
      ) : (
        
        /* 4. WHEN ONLINE: LIVE SEARCHING & RIDE DISPATCH STACK (Screenshot 5) */
        <div className="flex flex-col gap-3">
          
          {/* Online Header with Radar Pulse */}
          <div className="glass-card p-3.5 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Radio className="w-5 h-5 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <h2 className="text-sm font-black text-white">
                  {isKannada ? 'ನೀವು ಆನ್‌ಲೈನ್‌ ನಲ್ಲಿದ್ದೀರಿ' : 'You are Online'}
                </h2>
                <p className="text-[11px] text-emerald-300 font-bold">
                  {isKannada ? 'ರೈಡ್‌ಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...' : 'Searching for nearby trips...'}
                </p>
              </div>
            </div>

            {/* Session duration badge */}
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-black">Session</span>
              <div className="font-mono text-xs font-bold text-white">
                {formatTimer(sessionSeconds)}
              </div>
            </div>
          </div>

          {/* RIDE REQUEST STACK (Matching Screenshot 5) */}
          <div className="flex flex-col gap-2.5 mt-1">
            
            {/* Top Bar: Count & Sort dropdown */}
            <div className="flex items-center justify-between px-1">
              <span className="text-base font-black text-white">
                {availableRides.length} {isKannada ? 'ರೈಡ್‌ಗಳು (rides)' : 'rides available'}
              </span>

              <button
                onClick={() => setSortOrder(sortOrder === 'old_to_new' ? 'fare_high' : 'old_to_new')}
                className="touch-target px-3 py-1.5 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{sortOrder === 'old_to_new' ? 'Old to New' : 'Highest Fare'}</span>
              </button>
            </div>

            {/* Stack of Cards (Screenshot 5) */}
            {availableRides.length > 0 ? (
              availableRides.map((ride) => (
                <div 
                  key={ride.id}
                  className="rounded-3xl border border-white/10 bg-[#16161f] shadow-2xl overflow-hidden flex flex-col transition-all hover:border-white/20 animate-in slide-in-from-bottom-2"
                >
                  {/* Card Header: Auto • Cash & Fare / Rate */}
                  <div className="p-4 bg-[#1a1a24] border-b border-white/5 flex items-start justify-between">
                    <div>
                      <span className="text-xs text-gray-400 font-bold">
                        {ride.vehicleType} • {ride.paymentMode}
                      </span>
                      <div className="text-2xl font-black text-white mt-0.5 flex items-baseline gap-2">
                        <span>₹{ride.fare}</span>
                        <span className="text-xs text-gray-400 font-bold">
                          | ₹{ride.ratePerKm}/km
                        </span>
                      </div>
                    </div>

                    {/* Green highlight rate pill */}
                    <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black">
                      ₹{ride.fare}
                    </div>
                  </div>

                  {/* Route details: Pickup (Green) & Drop (Red) */}
                  <div className="p-4 flex flex-col gap-3">
                    
                    {/* Pickup row */}
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-emerald-500/20" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-emerald-400 block">
                          {ride.pickupDistance} • {ride.pickupDuration}
                        </span>
                        <p className="text-xs text-gray-200 mt-0.5 leading-relaxed font-medium">
                          {ride.pickupAddress}
                        </p>
                      </div>
                    </div>

                    {/* Dotted route connector line */}
                    <div className="w-0.5 h-3 bg-white/20 ml-1.5 -my-1" />

                    {/* Drop row */}
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0 ring-4 ring-red-500/20" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-red-400 block">
                          {ride.dropDistance} • {ride.dropDuration}
                        </span>
                        <p className="text-xs text-gray-200 mt-0.5 leading-relaxed font-medium">
                          {ride.dropAddress}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Actions row: Red [ ✕ ] Decline + Black [ ಸ್ವೀಕರಿಸಿ ] Accept (Screenshot 5) */}
                  <div className="p-3 bg-[#121218] border-t border-white/5 flex items-center gap-2.5">
                    
                    {/* Red Cross Button */}
                    <button
                      onClick={() => handleDeclineSingleRide(ride.id)}
                      className="touch-target w-12 h-12 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 flex items-center justify-center transition-all shrink-0 active:scale-95"
                      title="Decline"
                    >
                      <X className="w-6 h-6 stroke-[3]" />
                    </button>

                    {/* Big Black Button: "ಸ್ವೀಕರಿಸಿ" / "Accept in X" */}
                    <button
                      onClick={() => handleAcceptSingleRide(ride)}
                      className="touch-target flex-1 h-12 rounded-2xl bg-black hover:bg-gray-900 border border-white/25 text-white font-black text-sm tracking-wide shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2"
                    >
                      <span>{isKannada ? 'ಸ್ವೀಕರಿಸಿ' : 'Accept'}</span>
                      <span className="text-xs text-gray-400 font-mono">
                        ({ride.secondsRemaining}s)
                      </span>
                    </button>

                  </div>

                </div>
              ))
            ) : (
              <div className="p-8 rounded-3xl bg-[#121218] border border-white/10 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center animate-spin">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {isKannada ? 'ಹೊಸ ರೈಡ್‌ಗಳಿಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ...' : 'Waiting for incoming requests...'}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {isKannada ? 'ನೀವು ಮೊದಲ ಆದ್ಯತೆಯಲ್ಲಿದ್ದೀರಿ. ಪ್ರಯಾಣಿಕರು ಬುಕ್ ಮಾಡಿದ ತಕ್ಷಣ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.' : 'You will be notified immediately when riders book.'}
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Go Offline Button at bottom */}
          <button
            onClick={onToggleOnline}
            className="touch-target w-full py-3 rounded-2xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-gray-300 font-bold text-xs border border-white/10 transition-all mt-2"
          >
            {isKannada ? 'ಆಫ್‌ಲೈನ್‌ಗೆ ಹೋಗಿ' : 'Go Offline'}
          </button>

        </div>
      )}

      {/* PROMOTIONAL MODAL */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-5 border border-white/20 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 bg-[#121218]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Meter Cab Rates Info</h3>
              <button onClick={() => setShowPromoModal(false)} className="touch-target p-1 text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Official Bengaluru transport department fixed tariff fares applied directly without hidden platform commissions.
            </p>
            <button
              onClick={() => setShowPromoModal(false)}
              className="touch-target w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black"
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
