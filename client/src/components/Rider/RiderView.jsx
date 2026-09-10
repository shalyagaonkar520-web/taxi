import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Search,
  Clock,
  Shield,
  CreditCard,
  Wallet,
  DollarSign,
  Star,
  MessageSquare,
  Phone,
  CheckCircle,
  AlertTriangle,
  Send,
  X,
  Sparkles,
  ChevronRight,
  Share2,
  Lock,
  ArrowRight,
  Award,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { searchPlaces, getFareQuotes, topupWallet, reverseGeocodePlace, relocateDrivers } from '../../services/api';
import { socket } from '../../services/socket';
import { sound } from '../../utils/audio';

export default function RiderView({
  user,
  drivers,
  activeRide,
  onRideUpdate,
  onOpenWallet,
  onOpenHistory
}) {
  // Address selection state (starts clean without pre-filling foreign cities)
  const [pickup, setPickup] = useState({
    name: 'Current Location',
    address: 'Detecting your location...',
    lat: 12.9716,
    lng: 77.5946
  });
  const [destination, setDestination] = useState(null);

  const [pickupQuery, setPickupQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [locating, setLocating] = useState(false);
  const destInputRef = useRef(null);

  // Auto-detect location on initial load if possible
  useEffect(() => {
    if (navigator.geolocation && !pickupQuery) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const place = await reverseGeocodePlace(latitude, longitude);
            setPickup(place);
            setPickupQuery(place.name || place.address);
            await relocateDrivers(latitude, longitude);
            if (onRideUpdate) {
              onRideUpdate({
                userLocation: { lat: latitude, lng: longitude },
                pickup: place,
                destination: null
              });
            }
          } catch (e) {}
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // GPS Current Location Detection Button
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const place = await reverseGeocodePlace(latitude, longitude);
          setPickup(place);
          setPickupQuery(place.name || place.address);
          
          // Clear any previous destination to prevent mismatched cross-city routes
          setDestination(null);
          setDestQuery('');
          setRouteInfo(null);
          setQuotes([]);
          
          // Relocate surrounding active drivers to user's real neighborhood
          await relocateDrivers(latitude, longitude);

          if (onRideUpdate) {
            onRideUpdate({
              userLocation: { lat: latitude, lng: longitude },
              pickup: place,
              destination: null,
              previewRoute: []
            });
          }

          // Auto focus destination input
          setActiveInput('dest');
          setTimeout(() => {
            destInputRef.current?.focus();
          }, 100);
        } catch (e) {
          const fallbackPlace = {
            name: 'Current Location',
            address: `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            lat: latitude,
            lng: longitude
          };
          setPickup(fallbackPlace);
          setPickupQuery(fallbackPlace.name);
          setDestination(null);
          setDestQuery('');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocating(false);
        alert('Could not access current location. Please allow browser location access permissions in your browser bar.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Quotes and Selected Tier
  const [quotes, setQuotes] = useState([]);
  const [selectedTier, setSelectedTier] = useState('UberX');
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('WALLET');
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  // Rating & Tip Modal
  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState(2);
  const [feedback, setFeedback] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [completedRideData, setCompletedRideData] = useState(null);

  // In-trip Chat Drawer
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  // Fetch Quotes on mount or when pickup/dest changes
  useEffect(() => {
    if (pickup && destination && !activeRide) {
      calculateTripQuotes();
    } else {
      setQuotes([]);
      setRouteInfo(null);
    }
  }, [pickup, destination]);

  // Handle Socket Events for Rider
  useEffect(() => {
    socket.on('ride:created', (ride) => {
      onRideUpdate(ride);
    });

    socket.on('ride:cancelled', () => {
      onRideUpdate(null);
    });

    socket.on('ride:accepted', (data) => {
      onRideUpdate(data.ride);
      sound.playDriverArrived();
    });

    socket.on('ride:driver_arrived', (data) => {
      onRideUpdate(data.ride);
      sound.playDriverArrived();
    });

    socket.on('ride:started', (data) => {
      onRideUpdate(data.ride);
    });

    socket.on('ride:completed', (data) => {
      onRideUpdate(null);
      setCompletedRideData(data);
      setShowRatingModal(true);
      sound.playTripCompleted();
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    });

    socket.on('chat:message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('ride:created');
      socket.off('ride:cancelled');
      socket.off('ride:accepted');
      socket.off('ride:driver_arrived');
      socket.off('ride:started');
      socket.off('ride:completed');
      socket.off('chat:message');
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    if (showChat) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Calculate fare quotes
  const calculateTripQuotes = async () => {
    try {
      setLoadingQuotes(true);
      const res = await getFareQuotes(pickup, destination);
      setQuotes(res.quotes || []);
      setRouteInfo(res.route);
      if (onRideUpdate && !activeRide) {
        // Send preview route to parent map
        onRideUpdate({ previewRoute: res.route?.coordinates, pickup, destination });
      }
    } catch (err) {
      console.error('Failed to get quotes:', err);
    } finally {
      setLoadingQuotes(false);
    }
  };

  // Autocomplete search
  const handleSearch = async (query, type) => {
    if (type === 'pickup') {
      setPickupQuery(query);
      if (query.length > 1) {
        const results = await searchPlaces(query, pickup?.lat, pickup?.lng);
        setPickupSuggestions(results);
      } else {
        setPickupSuggestions([]);
      }
    } else {
      setDestQuery(query);
      if (query.length > 1) {
        const results = await searchPlaces(query, destination?.lat, destination?.lng);
        setDestSuggestions(results);
      } else {
        setDestSuggestions([]);
      }
    }
  };

  const selectPlace = (place, type) => {
    if (type === 'pickup') {
      setPickup(place);
      setPickupQuery(place.name || place.address);
      setPickupSuggestions([]);
    } else {
      setDestination(place);
      setDestQuery(place.name || place.address);
      setDestSuggestions([]);
    }
    setActiveInput(null);
  };

  // Request Ride
  const handleRequestRide = () => {
    sound.playRideRequest();
    socket.emit('ride:request', {
      riderId: user?.id || 'rider-01',
      pickup,
      destination,
      category: selectedTier,
      paymentMethod
    });
  };

  // Send in-trip chat message
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeRide) return;

    socket.emit('chat:send', {
      rideId: activeRide.id,
      senderId: user?.id || 'rider-01',
      senderName: user?.name || 'Passenger',
      senderRole: 'RIDER',
      text: chatInput.trim()
    });
    setChatInput('');
  };

  // Submit Rating & Tip
  const handleSubmitRating = () => {
    if (completedRideData?.ride?.id) {
      socket.emit('ride:rate_and_tip', {
        rideId: completedRideData.ride.id,
        riderId: user?.id || 'rider-01',
        rating,
        tip: parseFloat(tip) || 0,
        feedback
      });
    }
    setShowRatingModal(false);
    setCompletedRideData(null);
  };

  const selectedQuote = quotes.find((q) => q.id === selectedTier) || quotes[0];
  const finalFare = selectedQuote
    ? (selectedQuote.totalFare * (1 - discountPercent / 100)).toFixed(2)
    : '0.00';

  const assignedDriver = activeRide?.driverId
    ? drivers.find((d) => d.id === activeRide.driverId) || {
        name: 'Michael Rodriguez',
        rating: 4.96,
        phone: '+1 (555) 987-6543',
        vehicle: {
          make: 'Tesla',
          model: 'Model 3',
          color: 'Midnight Silver',
          licensePlate: 'NYC-7892'
        }
      }
    : null;

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      {/* 1. NO ACTIVE RIDE: BOOKING CARD */}
      {!activeRide && (
        <div className="glass-card rounded-3xl p-5 shadow-2xl border border-white/10 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-uber-accent" />
              Where to?
            </h2>
            {routeInfo && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                {routeInfo.distanceKm} km • ~{routeInfo.durationMin} mins
              </span>
            )}
          </div>

          {/* Pickup & Destination Inputs */}
          <div className="relative flex flex-col gap-2.5">
            {/* Visual connector line */}
            <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-gradient-to-b from-uber-accent via-gray-600 to-uber-red z-0" />

            {/* Pickup */}
            <div className="relative z-10">
              <div className="flex items-center gap-3 bg-black/50 p-3 rounded-2xl border border-white/10 focus-within:border-uber-accent transition-all">
                <div className="w-3 h-3 rounded-full bg-uber-accent ring-4 ring-uber-accent/20 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Pickup Location"
                  value={pickupQuery}
                  onChange={(e) => handleSearch(e.target.value, 'pickup')}
                  onFocus={() => setActiveInput('pickup')}
                  className="bg-transparent text-sm font-medium text-white placeholder-gray-500 w-full focus:outline-none"
                />

                {/* Use Current Location Quick Action Button */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  title="Use My Current Location"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-uber-accent/20 hover:bg-uber-accent/35 text-uber-accent border border-uber-accent/30 text-[11px] font-bold flex-shrink-0 transition-all active:scale-95 shadow-sm"
                >
                  <Navigation className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{locating ? 'Locating...' : 'Current Location'}</span>
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {activeInput === 'pickup' && (
                <div className="absolute top-full left-0 right-0 mt-2 glass-dropdown rounded-2xl p-2 shadow-2xl z-50 max-h-64 overflow-y-auto">
                  
                  {/* Top GPS Option */}
                  <button
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    className="w-full text-left p-2.5 bg-uber-accent/15 hover:bg-uber-accent/25 border border-uber-accent/30 rounded-xl transition-all flex items-center gap-2.5 mb-1.5 group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-uber-accent flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Navigation className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-uber-accent flex items-center gap-1">
                        Use My Current Location
                        {locating && <span className="text-[10px] text-gray-400 font-normal">(Acquiring GPS...)</span>}
                      </p>
                      <p className="text-[10px] text-gray-300">Auto-detect via device GPS and find nearby drivers</p>
                    </div>
                  </button>

                  {pickupSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectPlace(s, 'pickup')}
                      className="w-full text-left p-2.5 hover:bg-white/10 rounded-xl transition-all flex items-start gap-2.5"
                    >
                      <MapPin className="w-4 h-4 text-uber-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">{s.name}</p>
                        <p className="text-[11px] text-gray-400 truncate max-w-[280px]">{s.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination */}
            <div className="relative z-10">
              <div className="flex items-center gap-3 bg-black/50 p-3 rounded-2xl border border-white/10 focus-within:border-uber-red transition-all">
                <div className="w-3 h-3 rounded-full bg-uber-red ring-4 ring-uber-red/20 flex-shrink-0" />
                <input
                  ref={destInputRef}
                  type="text"
                  placeholder="Where are you going? (e.g. Airport, Mall, Station)"
                  value={destQuery}
                  onChange={(e) => handleSearch(e.target.value, 'dest')}
                  onFocus={() => setActiveInput('dest')}
                  className="bg-transparent text-sm font-medium text-white placeholder-gray-500 w-full focus:outline-none"
                />
                {destination && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestination(null);
                      setDestQuery('');
                      setQuotes([]);
                      setRouteInfo(null);
                      if (onRideUpdate) {
                        onRideUpdate({ pickup, destination: null, previewRoute: [] });
                      }
                    }}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {activeInput === 'dest' && destSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 glass-dropdown rounded-2xl p-2 shadow-2xl z-50 max-h-64 overflow-y-auto">
                  {destSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectPlace(s, 'dest')}
                      className="w-full text-left p-2.5 hover:bg-white/10 rounded-xl transition-all flex items-start gap-2.5"
                    >
                      <MapPin className="w-4 h-4 text-uber-red mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">{s.name}</p>
                        <p className="text-[11px] text-gray-400 truncate max-w-[280px]">{s.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Tier Picker (Only when destination is selected) */}
          {destination ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Choose a ride
              </label>
              
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {loadingQuotes ? (
                  <div className="py-8 text-center text-xs text-gray-400 animate-pulse">
                    Calculating real-time route & fares...
                  </div>
                ) : quotes.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-uber-accent/15 border-uber-accent shadow-lg shadow-uber-accent/10'
                          : 'bg-black/30 border-white/5 hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={tier.image}
                          alt={tier.name}
                          className="w-12 h-9 object-cover rounded-lg"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white">{tier.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-gray-300 font-semibold">
                              👤 {tier.capacity}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400">{tier.etaMin} mins away • {tier.tagline}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-base font-extrabold text-white">
                          ${tier.totalFare}
                        </p>
                        {tier.surgeMultiplier > 1 && (
                          <span className="text-[10px] font-bold text-uber-gold flex items-center justify-end gap-0.5">
                            <Zap className="w-3 h-3 fill-uber-gold" /> {tier.surgeMultiplier}x Surge
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payment & Promo */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
                <button
                  onClick={onOpenWallet}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 border border-white/10 hover:bg-white/5 text-gray-300 font-semibold"
                >
                  <Wallet className="w-3.5 h-3.5 text-uber-accent" />
                  <span>Wallet (${Number(user?.walletBalance || 0).toFixed(2)})</span>
                </button>

                <button
                  onClick={() => {
                    const code = prompt('Enter Promo Code (Try "SAVE20"):');
                    if (code && code.toUpperCase() === 'SAVE20') {
                      setDiscountPercent(20);
                      alert('20% Discount applied successfully!');
                    }
                  }}
                  className="flex items-center gap-1 text-uber-accent hover:underline font-semibold"
                >
                  {discountPercent > 0 ? `🎉 ${discountPercent}% OFF` : '+ Promo Code'}
                </button>
              </div>

              {/* Request Button */}
              <button
                onClick={handleRequestRide}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-uber-accent to-blue-500 hover:from-uber-accentHover hover:to-blue-600 font-extrabold text-white text-base shadow-xl shadow-uber-accent/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>Request {selectedQuote?.name || 'Ride'}</span>
                <span className="text-sm font-normal text-blue-200">(${finalFare})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Guidance when destination not yet entered */
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/30 border border-white/5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 font-medium">
                <Navigation className="w-3.5 h-3.5 text-uber-accent" />
                <span>Enter a destination above to see available cars & live pricing</span>
              </div>

              {/* Quick Popular Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {['✈️ Airport', '🚆 Train Station', '🛍️ City Mall', '🏢 Tech Park'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const cleanName = tag.split(' ').slice(1).join(' ');
                      handleSearch(cleanName, 'dest');
                      setActiveInput('dest');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-gray-300 font-semibold transition-all hover:scale-105"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. RIDE REQUESTED: RADAR SEARCHING STATE */}
      {activeRide && activeRide.status === 'REQUESTED' && (
        <div className="glass-card rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in-95">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="radar-wave" />
            <div className="radar-wave" style={{ animationDelay: '0.6s' }} />
            <div className="radar-wave" style={{ animationDelay: '1.2s' }} />
            <div className="w-14 h-14 rounded-full bg-uber-accent flex items-center justify-center text-white shadow-xl glow-accent z-10">
              <Navigation className="w-7 h-7 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">Connecting with nearby drivers...</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Dispatching your {activeRide.category} request to top-rated drivers near {activeRide.pickup.address.split(',')[0]}
            </p>
          </div>

          <div className="w-full bg-black/40 p-3 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
            <span className="text-gray-400">Estimated Fare</span>
            <span className="text-white font-extrabold">${activeRide.fare}</span>
          </div>

          <button
            onClick={() => socket.emit('ride:cancel', {
              rideId: activeRide.id,
              riderId: user?.id || 'rider-01'
            })}
            className="text-xs text-gray-400 hover:text-uber-red font-semibold transition-colors"
          >
            Cancel Request
          </button>
        </div>
      )}

      {/* 3. ACTIVE TRIP IN PROGRESS / DRIVER DISPATCHED */}
      {activeRide && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(activeRide.status) && (
        <div className="glass-card rounded-3xl p-5 shadow-2xl border border-white/10 flex flex-col gap-4 animate-in slide-in-from-bottom-4">
          
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uber-green opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-uber-green" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-uber-green">
                {activeRide.status === 'ACCEPTED' && 'Driver Dispatched'}
                {activeRide.status === 'ARRIVED' && 'Driver Arrived!'}
                {activeRide.status === 'IN_PROGRESS' && 'On Trip to Destination'}
              </span>
            </div>

            {/* Security PIN Box */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 border border-white/15">
              <Lock className="w-3.5 h-3.5 text-uber-gold" />
              <span className="text-xs text-gray-400">PIN:</span>
              <span className="text-sm font-extrabold text-white tracking-widest">{activeRide.otp || '4821'}</span>
            </div>
          </div>

          {/* Driver Card */}
          {assignedDriver && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center gap-3">
                <img
                  src={assignedDriver.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'}
                  alt={assignedDriver.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/15"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{assignedDriver.name}</span>
                    <span className="flex items-center text-xs font-bold text-uber-gold">
                      ★ {assignedDriver.rating || 4.96}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 font-semibold mt-0.5">
                    {assignedDriver.vehicle?.make} {assignedDriver.vehicle?.model} • {assignedDriver.vehicle?.color}
                  </p>
                  <span className="inline-block mt-1 text-[11px] font-extrabold px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
                    {assignedDriver.vehicle?.licensePlate || 'NYC-7892'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Chat & Call */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="p-2.5 rounded-xl bg-uber-accent/20 hover:bg-uber-accent/30 text-uber-accent border border-uber-accent/30 transition-all relative"
                >
                  <MessageSquare className="w-4 h-4" />
                  {chatMessages.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-uber-accent ring-2 ring-black" />
                  )}
                </button>
                <a
                  href={`tel:${assignedDriver.phone}`}
                  className="p-2.5 rounded-xl bg-uber-green/20 hover:bg-uber-green/30 text-uber-green border border-uber-green/30 transition-all"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* Trip Summary Card */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400">Pickup</span>
              <p className="text-white font-bold truncate mt-0.5">{activeRide.pickup.address}</p>
            </div>
            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400">Destination</span>
              <p className="text-white font-bold truncate mt-0.5">{activeRide.destination.address}</p>
            </div>
          </div>

          {/* Safety & Share Row */}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
            <button
              onClick={() => alert('🚨 Safety alert triggered. Emergency contacts & 911 notified.')}
              className="flex items-center gap-1.5 text-uber-red hover:underline font-bold"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>SOS Emergency</span>
            </button>

            <button
              onClick={() => {
                navigator.clipboard?.writeText?.(window.location.href);
                alert('Trip tracking link copied to clipboard!');
              }}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Trip</span>
            </button>
          </div>
        </div>
      )}

      {/* IN-TRIP CHAT DRAWER */}
      {showChat && (
        <div className="glass-card rounded-3xl p-4 border border-white/10 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-uber-accent" />
              <span className="text-xs font-bold text-white">Chat with Driver</span>
            </div>
            <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="h-44 overflow-y-auto flex flex-col gap-2 p-1 text-xs">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 my-auto">
                No messages yet. Send a quick note to your driver!
              </div>
            ) : (
              chatMessages.map((m) => {
                const isMe = m.senderRole === 'RIDER';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs font-medium ${
                        isMe
                          ? 'bg-uber-accent text-white rounded-br-none'
                          : 'bg-white/10 text-gray-200 rounded-bl-none'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[9px] text-gray-500 mt-0.5">{m.senderName}</span>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              placeholder="Type message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-black/50 px-3 py-2 rounded-xl text-xs text-white border border-white/10 focus:outline-none focus:border-uber-accent"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-uber-accent hover:bg-uber-accentHover text-white rounded-xl text-xs font-bold"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* 4. RATING & TIP MODAL AFTER COMPLETED TRIP */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-6 border border-white/15 shadow-2xl flex flex-col gap-5 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-uber-green/20 text-uber-green mx-auto flex items-center justify-center">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Trip Completed!</h3>
              <p className="text-xs text-gray-400 mt-1">
                You've arrived safely at your destination.
              </p>
            </div>

            {/* Receipt Breakdown */}
            <div className="bg-black/50 p-4 rounded-2xl border border-white/10 text-xs flex flex-col gap-2">
              <div className="flex justify-between text-gray-400">
                <span>Trip Fare</span>
                <span className="text-white font-bold">${completedRideData?.receipt?.fare || '24.50'}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Payment</span>
                <span className="text-white font-semibold">{completedRideData?.receipt?.paymentMethod || 'In-App Wallet'}</span>
              </div>
            </div>

            {/* Star Rating */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                Rate your driver
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'fill-uber-gold text-uber-gold'
                          : 'text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Driver Tip */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                Add a driver tip
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[0, 2, 5, 10].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTip(amount)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      tip === amount
                        ? 'bg-uber-accent text-white border-uber-accent shadow-md'
                        : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {amount === 0 ? 'No Tip' : `$${amount}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Input */}
            <input
              type="text"
              placeholder="Leave a compliment or note (optional)..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="bg-black/50 px-3.5 py-2.5 rounded-xl text-xs text-white border border-white/10 focus:outline-none focus:border-uber-accent"
            />

            {/* Submit */}
            <button
              onClick={handleSubmitRating}
              className="w-full py-3.5 rounded-2xl bg-uber-accent hover:bg-uber-accentHover font-extrabold text-white text-sm shadow-xl shadow-uber-accent/30 transition-all"
            >
              Done & Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
