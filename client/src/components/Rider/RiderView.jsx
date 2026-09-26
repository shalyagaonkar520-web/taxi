import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin,
  Navigation,
  Search,
  Clock,
  Shield,
  Star,
  MessageSquare,
  Phone,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Crosshair,
  Map,
  Wallet,
  Send,
  Loader2,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { searchPlaces, getFareQuotes, reverseGeocodePlace, relocateDrivers } from '../../services/api';
import { socket } from '../../services/socket';
import { sound } from '../../utils/audio';
import LiveMap from '../Map/LiveMap';

/* ------------------------------------------------------------------
   Three simple choices. Each maps onto a backend fare category so the
   server keeps working exactly as before.
------------------------------------------------------------------- */
const VEHICLES = [
  {
    key: 'BIKE',
    category: 'UberMoto',
    emoji: '🏍️',
    label: 'Bike',
    seats: '1 person',
    note: 'Cheapest. Best in traffic.'
  },
  {
    key: 'AUTO',
    category: 'UberAuto',
    emoji: '🛺',
    label: 'Auto',
    seats: '3 people',
    note: 'Good for short trips.'
  },
  {
    key: 'CAR',
    category: 'UberGo',
    emoji: '🚗',
    label: 'Car',
    seats: '4 people',
    note: 'AC. Most comfortable.'
  }
];

const CITY_SPEED_KMPH = 24;

function distanceKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function minutesFromKm(km) {
  if (km == null) return null;
  return Math.max(1, Math.round((km / CITY_SPEED_KMPH) * 60));
}

function placeTitle(place) {
  if (!place) return '';
  return place.name || (place.address || '').split(',')[0] || 'Selected place';
}

function placeSubtitle(place) {
  if (!place) return '';
  return place.address || '';
}

/* ------------------------------------------------------------------
   Small shared building blocks (kept plain so nothing can overlap)
------------------------------------------------------------------- */
function Sheet({ children }) {
  return <div className="sheet-rise w-full flex flex-col gap-4 p-4 sm:p-5">{children}</div>;
}

/* Full screen panels are portalled to <body>. The rider sheet sits in its own
   stacking context, so an overlay rendered inside it would slide under the
   navbar no matter how high its z-index is. */
function Overlay({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function BigButton({ children, onClick, disabled, tone = 'primary', type = 'button' }) {
  const tones = {
    primary: 'bg-uber-accent hover:bg-uber-accentHover text-white shadow-lg shadow-uber-accent/25',
    green: 'bg-uber-green hover:bg-uber-greenHover text-white shadow-lg shadow-uber-green/25',
    danger:
      'bg-white text-uber-red border-2 border-uber-red/30 hover:bg-red-50 dark:bg-transparent dark:hover:bg-uber-red/10',
    quiet:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20'
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl px-5 py-4 text-base font-extrabold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function StepTitle({ onBack, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back"
          className="mt-0.5 shrink-0 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ================================================================== */

export default function RiderView({
  user,
  drivers = [],
  activeRide,
  onRideUpdate,
  onOpenWallet,
  onOpenHistory
}) {
  /* ---------------- Trip building state ---------------- */
  const [step, setStep] = useState('LOCATION'); // LOCATION | VEHICLE
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);

  const [pickupQuery, setPickupQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null); // 'pickup' | 'drop'
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const destInputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const rootRef = useRef(null);

  /* ---------------- Map pin picker ---------------- */
  const [pickerFor, setPickerFor] = useState(null); // null | 'pickup' | 'drop'
  const [pickerCoords, setPickerCoords] = useState([12.9716, 77.5946]);
  const [pickerPlace, setPickerPlace] = useState(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const geocodeTimerRef = useRef(null);

  /* ---------------- Fare / vehicle ---------------- */
  const [quotes, setQuotes] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('CAR');
  const [paymentMethod, setPaymentMethod] = useState('WALLET');

  /* ---------------- Live trip ---------------- */
  const [acceptedDriver, setAcceptedDriver] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatBottomRef = useRef(null);

  /* ---------------- Rating ---------------- */
  const [completedRide, setCompletedRide] = useState(null);
  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState(0);
  const [feedback, setFeedback] = useState('');

  const rideStatus = activeRide?.status || null;
  const isLive = ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(rideStatus);

  /* ================= Location helpers ================= */

  const pushPreview = (nextPickup, nextDestination, route, center) => {
    if (!onRideUpdate) return;
    onRideUpdate({
      type: 'PREVIEW',
      pickup: nextPickup || null,
      destination: nextDestination || null,
      route: route || [],
      center: center || null
    });
  };

  const applyPickup = async (place, { relocate = false, keepDestination = true } = {}) => {
    setPickup(place);
    setPickupQuery(placeTitle(place));
    setSuggestions([]);
    setActiveField(null);
    if (relocate) {
      try {
        await relocateDrivers(place.lat, place.lng);
      } catch (e) {
        /* drivers stay where they are - not fatal */
      }
    }
    pushPreview(place, keepDestination ? destination : null, [], { lat: place.lat, lng: place.lng });
  };

  const applyDestination = (place) => {
    setDestination(place);
    setDestQuery(placeTitle(place));
    setSuggestions([]);
    setActiveField(null);
    pushPreview(pickup, place, []);
  };

  // Try to find the rider once, on first open.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const place = await reverseGeocodePlace(latitude, longitude);
          await applyPickup(place, { relocate: true });
        } catch (e) {
          /* rider can still type an address */
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseCurrentLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Your browser cannot share location. Please type the address instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let place;
        try {
          place = await reverseGeocodePlace(latitude, longitude);
        } catch (e) {
          place = {
            name: 'My current location',
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude,
            lng: longitude
          };
        }
        // A new city means the old drop point no longer makes sense.
        setDestination(null);
        setDestQuery('');
        setQuotes([]);
        setRouteInfo(null);
        await applyPickup(place, { relocate: true, keepDestination: false });
        setLocating(false);
        setActiveField('drop');
        setTimeout(() => destInputRef.current?.focus(), 120);
      },
      () => {
        setLocating(false);
        setLocationError(
          'We could not read your location. Please allow location in your browser, or type the address.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  /* ================= Address search ================= */

  const handleQueryChange = (value, field) => {
    if (field === 'pickup') setPickupQuery(value);
    else setDestQuery(value);
    setActiveField(field);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(value, pickup?.lat, pickup?.lng);
        setSuggestions(Array.isArray(results) ? results : []);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  /* ================= Map pin picker ================= */

  const openPicker = (field) => {
    const base = field === 'pickup' ? pickup || destination : destination || pickup;
    const lat = base?.lat ?? 12.9716;
    const lng = base?.lng ?? 77.5946;
    setPickerCoords([lat, lng]);
    setPickerPlace(null);
    setPickerFor(field);
    loadPickerAddress(lat, lng);
  };

  const loadPickerAddress = async (lat, lng) => {
    setPickerLoading(true);
    try {
      const place = await reverseGeocodePlace(lat, lng);
      setPickerPlace(place);
    } catch (e) {
      setPickerPlace({
        name: 'Pin on map',
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng
      });
    } finally {
      setPickerLoading(false);
    }
  };

  const handlePickerMove = ({ lat, lng }) => {
    setPickerCoords([lat, lng]);
    setPickerPlace(null);
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => loadPickerAddress(lat, lng), 420);
  };

  const confirmPicker = async () => {
    if (!pickerPlace) return;
    if (pickerFor === 'pickup') {
      await applyPickup(pickerPlace, { relocate: true });
    } else {
      applyDestination(pickerPlace);
    }
    setPickerFor(null);
  };

  /* ================= Fare quotes ================= */

  useEffect(() => {
    if (!pickup || !destination || isLive) {
      setQuotes([]);
      setRouteInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingQuotes(true);
      setQuoteError('');
      try {
        const res = await getFareQuotes(pickup, destination);
        if (cancelled) return;
        setQuotes(res.quotes || []);
        setRouteInfo(res.route || null);
        pushPreview(pickup, destination, res.route?.coordinates || []);
      } catch (err) {
        if (cancelled) return;
        setQuoteError('We could not work out the price. Please check the addresses and try again.');
      } finally {
        if (!cancelled) setLoadingQuotes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, destination, isLive]);

  /* ================= Socket events ================= */

  useEffect(() => {
    const onCreated = (ride) => onRideUpdate?.(ride);

    const onCancelled = () => {
      onRideUpdate?.(null);
      setAcceptedDriver(null);
      setConfirmCancel(false);
      setChatMessages([]);
      setShowChat(false);
      setStep('LOCATION');
    };

    const onAccepted = (data) => {
      setAcceptedDriver(data.driver || null);
      onRideUpdate?.(data.ride);
      sound.playDriverArrived();
    };

    const onArrived = (data) => {
      onRideUpdate?.(data.ride);
      sound.playDriverArrived();
    };

    const onStarted = (data) => onRideUpdate?.(data.ride);

    const onCompleted = (data) => {
      onRideUpdate?.(null);
      setCompletedRide(data);
      setAcceptedDriver(null);
      setChatMessages([]);
      setShowChat(false);
      setStep('LOCATION');
      setDestination(null);
      setDestQuery('');
      sound.playTripCompleted();
      confetti({ particleCount: 110, spread: 70, origin: { y: 0.6 } });
    };

    const onChat = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (msg.senderRole !== 'RIDER') setUnreadCount((c) => c + 1);
    };

    socket.on('ride:created', onCreated);
    socket.on('ride:cancelled', onCancelled);
    socket.on('ride:accepted', onAccepted);
    socket.on('ride:driver_arrived', onArrived);
    socket.on('ride:started', onStarted);
    socket.on('ride:completed', onCompleted);
    socket.on('chat:message', onChat);

    return () => {
      socket.off('ride:created', onCreated);
      socket.off('ride:cancelled', onCancelled);
      socket.off('ride:accepted', onAccepted);
      socket.off('ride:driver_arrived', onArrived);
      socket.off('ride:started', onStarted);
      socket.off('ride:completed', onCompleted);
      socket.off('chat:message', onChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Every new screen starts at the top. Without this the sheet keeps the
  // previous screen's scroll position and hides the new heading.
  useEffect(() => {
    const sheet = rootRef.current?.closest('[data-rider-sheet]');
    if (sheet) sheet.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, rideStatus]);

  /* ================= Derived values ================= */

  const onlineDrivers = useMemo(
    () => drivers.filter((d) => d.status === 'ONLINE' && d.location?.lat),
    [drivers]
  );

  const nearbyDrivers = useMemo(() => {
    if (!pickup) return onlineDrivers.map((d) => ({ ...d, km: null }));
    return onlineDrivers
      .map((d) => ({ ...d, km: distanceKm(pickup, d.location) }))
      .filter((d) => d.km != null && d.km <= 10)
      .sort((a, b) => a.km - b.km);
  }, [onlineDrivers, pickup]);

  const selectedVehicleDef = VEHICLES.find((v) => v.key === selectedVehicle) || VEHICLES[2];

  const quoteFor = (vehicle) => quotes.find((q) => q.id === vehicle.category) || null;
  const selectedQuote = quoteFor(selectedVehicleDef);
  const currency = selectedQuote?.currency || '$';

  const assignedDriver =
    (activeRide?.driverId && drivers.find((d) => d.id === activeRide.driverId)) ||
    acceptedDriver ||
    null;

  // Live position comes from the drivers list, which the socket keeps fresh.
  const liveDriverLocation =
    (activeRide?.driverId && drivers.find((d) => d.id === activeRide.driverId)?.location) ||
    acceptedDriver?.location ||
    null;

  const trackingTarget =
    rideStatus === 'IN_PROGRESS' ? activeRide?.destination : activeRide?.pickup;

  const remainingKm = distanceKm(liveDriverLocation, trackingTarget);
  const remainingMin =
    rideStatus === 'ARRIVED'
      ? 0
      : minutesFromKm(remainingKm) ?? activeRide?.etaToPickupMin ?? null;

  /* ================= Actions ================= */

  const handleConfirmTrip = () => {
    if (!pickup || !destination) return;
    sound.playRideRequest();
    socket.emit('ride:request', {
      riderId: user?.id || 'rider-01',
      pickup,
      destination,
      category: selectedVehicleDef.category,
      paymentMethod
    });
  };

  const handleCancelRide = () => {
    if (!activeRide) return;
    socket.emit('ride:cancel', {
      rideId: activeRide.id,
      riderId: user?.id || 'rider-01'
    });
    setConfirmCancel(false);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeRide) return;
    socket.emit('chat:send', {
      rideId: activeRide.id,
      senderId: user?.id || 'rider-01',
      senderName: user?.name || 'Rider',
      senderRole: 'RIDER',
      text: chatInput.trim()
    });
    setChatInput('');
  };

  const handleSubmitRating = () => {
    if (completedRide?.ride?.id) {
      socket.emit('ride:rate_and_tip', {
        rideId: completedRide.ride.id,
        riderId: user?.id || 'rider-01',
        rating,
        tip: Number(tip) || 0,
        feedback
      });
    }
    setCompletedRide(null);
    setRating(5);
    setTip(0);
    setFeedback('');
  };

  /* ================= Screens ================= */

  const addressField = (field) => {
    const isPickup = field === 'pickup';
    const value = isPickup ? pickupQuery : destQuery;
    const chosen = isPickup ? pickup : destination;
    const focused = activeField === field;

    return (
      <div
        className={`rounded-2xl border-2 transition-colors ${
          focused
            ? 'border-uber-accent bg-white dark:bg-[#16161b]'
            : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <span
            className={`shrink-0 w-3.5 h-3.5 rounded-full ${
              isPickup ? 'bg-uber-green' : 'bg-uber-red'
            }`}
          />
          <div className="min-w-0 flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPickup ? 'Pick up from' : 'Go to'}
            </label>
            <input
              ref={isPickup ? null : destInputRef}
              value={value}
              onChange={(e) => handleQueryChange(e.target.value, field)}
              onFocus={() => setActiveField(field)}
              placeholder={isPickup ? 'Where are you now?' : 'Where do you want to go?'}
              className="w-full bg-transparent text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none py-0.5"
            />
          </div>
          {value && (
            <button
              onClick={() => {
                if (isPickup) {
                  setPickup(null);
                  setPickupQuery('');
                } else {
                  setDestination(null);
                  setDestQuery('');
                }
                setSuggestions([]);
                setActiveField(field);
              }}
              aria-label="Clear"
              className="shrink-0 w-7 h-7 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {chosen && !focused && placeSubtitle(chosen) && (
          <p className="px-4 pb-3 -mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {placeSubtitle(chosen)}
          </p>
        )}

        {/* Helper buttons sit inside the field block so nothing floats over text */}
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {isPickup && (
            <button
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="flex items-center gap-1.5 rounded-full bg-uber-accent/10 text-uber-accent px-3 py-2 text-xs font-bold hover:bg-uber-accent/20 transition-colors disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Crosshair className="w-4 h-4" />
              )}
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
          )}
          <button
            onClick={() => openPicker(field)}
            className="flex items-center gap-1.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-300/70 dark:hover:bg-white/20 transition-colors"
          >
            <Map className="w-4 h-4" />
            Choose on map
          </button>
        </div>
      </div>
    );
  };

  const locationScreen = (
    <Sheet>
      <StepTitle
        title={`Hi ${(user?.name || 'there').split(' ')[0]} 👋`}
        subtitle="Step 1 of 2 — tell us where to pick you up and where to go."
      />

      <div className="flex flex-col gap-3">
        {addressField('pickup')}
        {addressField('drop')}
      </div>

      {locationError && (
        <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {locationError}
        </p>
      )}

      {/* Suggestions are listed in the flow, never floating on top of text */}
      {activeField && (searching || suggestions.length > 0) && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
          {searching && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}
          {suggestions.map((place, i) => (
            <button
              key={`${place.lat}-${place.lng}-${i}`}
              onClick={() =>
                activeField === 'pickup'
                  ? applyPickup(place, { relocate: true })
                  : applyDestination(place)
              }
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 border-t first:border-t-0 border-slate-100 dark:border-white/5 transition-colors"
            >
              <span className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300">
                <MapPin className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                  {placeTitle(place)}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {placeSubtitle(place)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-white/5 px-4 py-3">
        <Users className="w-4 h-4 text-uber-green shrink-0" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-white">{nearbyDrivers.length}</span>{' '}
          {nearbyDrivers.length === 1 ? 'driver is' : 'drivers are'} near you right now
        </p>
      </div>

      <BigButton onClick={() => setStep('VEHICLE')} disabled={!pickup || !destination}>
        Next — choose your ride <ArrowRight className="w-5 h-5" />
      </BigButton>

      {(!pickup || !destination) && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 -mt-1">
          Fill both boxes above to continue.
        </p>
      )}
    </Sheet>
  );

  const vehicleScreen = (
    <Sheet>
      <StepTitle
        onBack={() => setStep('LOCATION')}
        title="Choose your ride"
        subtitle="Step 2 of 2 — pick a vehicle, then confirm."
      />

      {/* Trip summary, always readable */}
      <div className="rounded-2xl bg-slate-50 dark:bg-white/5 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 shrink-0 w-3 h-3 rounded-full bg-uber-green" />
          <p className="min-w-0 text-sm font-semibold text-slate-900 dark:text-white truncate">
            {placeTitle(pickup)}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 shrink-0 w-3 h-3 rounded-full bg-uber-red" />
          <p className="min-w-0 text-sm font-semibold text-slate-900 dark:text-white truncate">
            {placeTitle(destination)}
          </p>
        </div>
        {routeInfo && (
          <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
            About {routeInfo.distanceKm?.toFixed(1)} km · {Math.ceil(routeInfo.durationMin)} min drive
          </p>
        )}
      </div>

      {quoteError && (
        <p className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {quoteError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {VEHICLES.map((v) => {
          const q = quoteFor(v);
          const isSelected = selectedVehicle === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setSelectedVehicle(v.key)}
              className={`w-full flex items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-all ${
                isSelected
                  ? 'border-uber-accent bg-uber-accent/5 dark:bg-uber-accent/10'
                  : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <span className="text-3xl leading-none shrink-0" aria-hidden="true">
                {v.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {v.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {v.seats}
                  </span>
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {v.note}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {loadingQuotes ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 ml-auto" />
                ) : q ? (
                  <>
                    <span className="block text-lg font-extrabold text-slate-900 dark:text-white">
                      {q.currency}
                      {q.totalFare.toFixed(2)}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {q.etaMin} min away
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </span>
              {isSelected && (
                <span className="shrink-0 w-6 h-6 rounded-full bg-uber-accent text-white flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Payment - two plain choices */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          How will you pay?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              id: 'WALLET',
              label: 'Wallet',
              hint: `${currency}${Number(user?.walletBalance || 0).toFixed(2)}`
            },
            { id: 'CASH', label: 'Cash', hint: 'Pay the driver' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPaymentMethod(p.id)}
              className={`rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                paymentMethod === p.id
                  ? 'border-uber-accent bg-uber-accent/5 dark:bg-uber-accent/10'
                  : 'border-slate-200 dark:border-white/10'
              }`}
            >
              <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
                {p.label}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                {p.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <BigButton onClick={handleConfirmTrip} disabled={!selectedQuote || loadingQuotes} tone="green">
        {selectedQuote
          ? `Book ${selectedVehicleDef.label} · ${currency}${selectedQuote.totalFare.toFixed(2)}`
          : 'Getting price…'}
      </BigButton>
    </Sheet>
  );

  const searchingScreen = (
    <Sheet>
      <div className="flex items-center gap-4">
        <span className="relative shrink-0 w-12 h-12 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-uber-accent/20 animate-ping" />
          <span className="relative w-12 h-12 rounded-full bg-uber-accent/15 text-uber-accent flex items-center justify-center">
            <Search className="w-6 h-6" />
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Looking for a driver…
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            We are asking {nearbyDrivers.length}{' '}
            {nearbyDrivers.length === 1 ? 'driver' : 'drivers'} near you.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {nearbyDrivers.slice(0, 4).map((d, i) => (
          <div
            key={d.id}
            className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0 border-slate-100 dark:border-white/5"
          >
            <img
              src={d.avatar}
              alt=""
              className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-200"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {d.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {d.km != null ? `${d.km.toFixed(1)} km away · ${minutesFromKm(d.km)} min` : 'Nearby'}
              </p>
            </div>
            <span
              className="shrink-0 text-[11px] font-bold text-uber-accent animate-pulse"
              style={{ animationDelay: `${i * 220}ms` }}
            >
              Ringing…
            </span>
          </div>
        ))}
        {nearbyDrivers.length === 0 && (
          <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
            No driver has answered yet. Please wait a moment.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-slate-50 dark:bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
        <span className="min-w-0 text-sm text-slate-600 dark:text-slate-300 truncate">
          {selectedVehicleDef.emoji} {selectedVehicleDef.label} to{' '}
          {placeTitle(activeRide?.destination)}
        </span>
        <span className="shrink-0 text-sm font-extrabold text-slate-900 dark:text-white">
          {currency}
          {Number(activeRide?.fare || 0).toFixed(2)}
        </span>
      </div>

      <BigButton tone="danger" onClick={handleCancelRide}>
        Cancel
      </BigButton>
    </Sheet>
  );

  const driverPanel = (
    <Sheet>
      {/* Status line - the one thing the rider must read */}
      <div className="flex items-center gap-3">
        <span
          className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
            rideStatus === 'IN_PROGRESS'
              ? 'bg-uber-accent/15 text-uber-accent'
              : 'bg-uber-green/15 text-uber-green'
          }`}
        >
          {rideStatus === 'IN_PROGRESS' ? (
            <Navigation className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
            {rideStatus === 'ARRIVED'
              ? 'Your driver is here'
              : rideStatus === 'IN_PROGRESS'
              ? 'On the way to your drop'
              : 'Your driver is coming'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {rideStatus === 'ARRIVED'
              ? 'Please come out and meet your driver.'
              : remainingMin != null
              ? `About ${remainingMin} ${remainingMin === 1 ? 'minute' : 'minutes'} away`
              : 'Working out the time…'}
          </p>
        </div>
      </div>

      {/* Start PIN */}
      {activeRide?.otp && rideStatus !== 'IN_PROGRESS' && (
        <div className="rounded-2xl bg-uber-accent/10 border border-uber-accent/25 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-uber-accent">Start PIN</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Tell this to your driver</p>
          </div>
          <p className="shrink-0 text-2xl font-black tracking-[0.3em] text-slate-900 dark:text-white">
            {activeRide.otp}
          </p>
        </div>
      )}

      {/* Driver details */}
      {assignedDriver && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <img
              src={assignedDriver.avatar}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover shrink-0 bg-slate-200"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                {assignedDriver.name}
              </p>
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Star className="w-3.5 h-3.5 fill-uber-gold text-uber-gold shrink-0" />
                {assignedDriver.rating || '4.9'}
                {assignedDriver.totalTrips ? ` · ${assignedDriver.totalTrips} trips` : ''}
              </p>
            </div>
          </div>

          {assignedDriver.vehicle && (
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {assignedDriver.vehicle.color} {assignedDriver.vehicle.make}{' '}
                  {assignedDriver.vehicle.model}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Look for this vehicle</p>
              </div>
              <span className="shrink-0 rounded-lg bg-slate-900 dark:bg-white px-3 py-1.5 text-sm font-black tracking-wider text-white dark:text-slate-900">
                {assignedDriver.vehicle.licensePlate}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`tel:${assignedDriver.phone || ''}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-uber-green text-white px-4 py-3 text-sm font-extrabold hover:bg-uber-greenHover transition-colors"
            >
              <Phone className="w-4 h-4" /> Call
            </a>
            <button
              onClick={() => setShowChat(true)}
              className="relative flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white px-4 py-3 text-sm font-extrabold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> Message
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 rounded-full bg-uber-red text-white text-[11px] font-black flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Trip summary */}
      <div className="rounded-2xl bg-slate-50 dark:bg-white/5 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 shrink-0 w-3 h-3 rounded-full bg-uber-green" />
          <p className="min-w-0 text-sm text-slate-700 dark:text-slate-200 truncate">
            {placeTitle(activeRide?.pickup)}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 shrink-0 w-3 h-3 rounded-full bg-uber-red" />
          <p className="min-w-0 text-sm text-slate-700 dark:text-slate-200 truncate">
            {placeTitle(activeRide?.destination)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {activeRide?.paymentMethod === 'CASH' ? 'Pay cash' : 'Paid from wallet'}
          </span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white">
            {currency}
            {Number(activeRide?.fare || 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Cancel */}
      {rideStatus !== 'IN_PROGRESS' &&
        (confirmCancel ? (
          <div className="rounded-2xl border-2 border-uber-red/30 p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Cancel this ride? Your driver is already on the way.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmCancel(false)}
                className="rounded-xl bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm font-extrabold text-slate-800 dark:text-white"
              >
                Keep ride
              </button>
              <button
                onClick={handleCancelRide}
                className="rounded-xl bg-uber-red px-4 py-3 text-sm font-extrabold text-white"
              >
                Yes, cancel
              </button>
            </div>
          </div>
        ) : (
          <BigButton tone="danger" onClick={() => setConfirmCancel(true)}>
            Cancel ride
          </BigButton>
        ))}

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Shield className="w-3.5 h-3.5 text-uber-green" /> Your trip is being tracked for safety
      </p>
    </Sheet>
  );

  /* ================= Render ================= */

  let body;
  if (rideStatus === 'REQUESTED') body = searchingScreen;
  else if (['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(rideStatus)) body = driverPanel;
  else if (step === 'VEHICLE') body = vehicleScreen;
  else body = locationScreen;

  return (
    <div className="w-full" ref={rootRef}>
      {body}

      {/* Quick links, only while planning a trip */}
      {!isLive && (
        <div className="flex items-center justify-center gap-2 px-4 pb-6">
          <button
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-white/10 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <Wallet className="w-4 h-4" /> Wallet
          </button>
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-white/10 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <Clock className="w-4 h-4" /> My rides
          </button>
        </div>
      )}

      {/* ---------- Message drawer ---------- */}
      {showChat && (
        <Overlay>
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md h-[75vh] sm:h-[70vh] bg-white dark:bg-[#16161b] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
              <p className="min-w-0 text-base font-extrabold text-slate-900 dark:text-white truncate">
                {assignedDriver?.name || 'Your driver'}
              </p>
              <button
                onClick={() => setShowChat(false)}
                aria-label="Close messages"
                className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
              {chatMessages.length === 0 && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                  Send a message to your driver.
                </p>
              )}
              {chatMessages.map((m) => {
                const mine = m.senderRole === 'RIDER';
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <p
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm break-words ${
                        mine
                          ? 'bg-uber-accent text-white'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white'
                      }`}
                    >
                      {m.text}
                    </p>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-white/10"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 min-w-0 rounded-full bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              <button
                type="submit"
                aria-label="Send"
                className="shrink-0 w-11 h-11 rounded-full bg-uber-accent text-white flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
        </Overlay>
      )}

      {/* ---------- Rating ---------- */}
      {completedRide && (
        <Overlay>
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="w-full sm:max-w-md bg-white dark:bg-[#16161b] rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-11 h-11 rounded-full bg-uber-green/15 text-uber-green flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  You have arrived
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Trip finished. Thanks for riding.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">Total paid</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {currency}
                {Number(completedRide.receipt?.fare || 0).toFixed(2)}
              </span>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                How was your driver?
              </p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star
                      className={`w-9 h-9 ${
                        n <= rating
                          ? 'fill-uber-gold text-uber-gold'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                Add a tip? (optional)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 5].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTip(amt)}
                    className={`rounded-xl px-2 py-3 text-sm font-extrabold border-2 transition-all ${
                      tip === amt
                        ? 'border-uber-accent bg-uber-accent/5 text-uber-accent'
                        : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {amt === 0 ? 'No tip' : `${currency}${amt}`}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Anything to say? (optional)"
              className="w-full rounded-xl bg-slate-100 dark:bg-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
            />

            <BigButton tone="green" onClick={handleSubmitRating}>
              Done
            </BigButton>
          </div>
        </div>
        </Overlay>
      )}

      {/* ---------- Map pin picker ---------- */}
      {pickerFor && (
        <Overlay>
        <div className="fixed inset-0 z-[80] bg-white dark:bg-[#09090b] flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
            <button
              onClick={() => setPickerFor(null)}
              aria-label="Go back"
              className="shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                {pickerFor === 'pickup' ? 'Set your pickup point' : 'Set your drop point'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Move the map so the pin sits on the right spot.
              </p>
            </div>
          </div>

          <div className="relative flex-1">
            <LiveMap
              center={pickerCoords}
              zoom={16}
              isPickerMode
              pickerType={pickerFor === 'pickup' ? 'pickup' : 'dest'}
              onPickerCenterChange={handlePickerMove}
            />
          </div>

          <div className="px-4 py-4 border-t border-slate-200 dark:border-white/10 flex flex-col gap-3">
            <div className="flex items-start gap-3 min-h-[44px]">
              <span className="mt-1 shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300">
                <MapPin className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                {pickerLoading || !pickerPlace ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 pt-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> Reading the address…
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {placeTitle(pickerPlace)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {placeSubtitle(pickerPlace)}
                    </p>
                  </>
                )}
              </div>
            </div>
            <BigButton onClick={confirmPicker} disabled={!pickerPlace || pickerLoading}>
              {pickerFor === 'pickup' ? 'Confirm pickup' : 'Confirm drop'}
            </BigButton>
          </div>
        </div>
        </Overlay>
      )}
    </div>
  );
}
