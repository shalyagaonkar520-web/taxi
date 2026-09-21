import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Car, 
  Package, 
  Check, 
  MapPin, 
  Sliders, 
  Navigation, 
  Sparkles,
  Info,
  Shield,
  Search
} from 'lucide-react';

export default function DriverServicesTab({
  driver,
  onBack,
  currentLanguage = 'kn',
  destinationMode,
  onUpdateDestination
}) {
  const isKannada = currentLanguage === 'kn';

  // Active services selection state (defaults to all enabled)
  const [selectedServices, setSelectedServices] = useState({
    taxi: true,
    auto: true,
    package: true
  });

  const [destEnabled, setDestEnabled] = useState(destinationMode?.enabled || false);
  const [destAddress, setDestAddress] = useState(destinationMode?.destination?.address || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleService = (key) => {
    // Ensure at least one service remains checked
    const count = Object.values(selectedServices).filter(Boolean).length;
    if (count === 1 && selectedServices[key]) return;

    setSelectedServices((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveDestination = (e) => {
    e.preventDefault();
    if (!destAddress.trim()) {
      onUpdateDestination({ enabled: false, destination: null });
      setDestEnabled(false);
    } else {
      onUpdateDestination({
        enabled: destEnabled,
        destination: { 
          address: destAddress.trim(), 
          lat: 12.9716, 
          lng: 77.5946 
        }
      });
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const popularAreas = [
    'ಕನಕಪುರ ರೋಡ್ (Kanakapura Road)',
    'ಪದ್ಮನಾಭನಗರ (Padmanabhanagar)',
    'ಜೆಪಿ ನಗರ (JP Nagar 6th Phase)',
    'ಮೆಜೆಸ್ಟಿಕ್ (Majestic Bus Stand)',
    'ಇಂದಿರಾನಗರ (Indiranagar 100ft Rd)',
    'ಕೋರಮಂಗಲ (Koramangala 5th Block)',
    'ವೈಟ್‌ಫೀಲ್ಡ್ (Whitefield ITPL)'
  ];

  return (
    <div className="flex flex-col gap-4 pb-28 w-full max-w-md mx-auto text-white animate-in fade-in">
      
      {/* TOP HEADER WITH BACK ARROW (Screenshot 4) */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onBack}
            className="touch-target p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black text-white">
            {isKannada ? 'ಆದ್ಯತೆಗಳು' : 'Preferences'}
          </h1>
        </div>
        <span className="text-xs font-bold text-gray-400">
          {driver?.vehicle?.licensePlate || 'KA-01-EQ-7892'}
        </span>
      </div>

      {/* GREEN STATUS PILL BANNER (Screenshot 4) */}
      <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{isKannada ? 'ಎಲ್ಲಾ ಟ್ರಿಪ್‌ಗಳಿಗೆ ಮುಕ್ತವಾಗಿದೆ' : 'Open to all trips'}</span>
        </div>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200">
          {isKannada ? 'ಸಕ್ರಿಯ' : 'Active'}
        </span>
      </div>

      {/* SECTION: SERVICES / ಸೇವೆಗಳು (Screenshot 4) */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-base font-black text-white tracking-wide">
          {isKannada ? 'ಸೇವೆಗಳು' : 'Services'}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          
          {/* 1. TAXI / ಟ್ಯಾಕ್ಸಿ CARD */}
          <div 
            onClick={() => toggleService('taxi')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[125px] ${
              selectedServices.taxi
                ? 'bg-[#181820] border-white/60 shadow-lg ring-1 ring-white/20'
                : 'bg-[#101014] border-white/10 opacity-60'
            }`}
          >
            {/* Top checkmark */}
            <div className="flex justify-end">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                selectedServices.taxi ? 'bg-white text-black font-black' : 'border border-white/20'
              }`}>
                {selectedServices.taxi && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>

            {/* Icon and label */}
            <div className="flex flex-col gap-1 mt-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <Car className="w-5 h-5" />
              </div>
              <span className="text-sm font-black text-white mt-1">
                {isKannada ? 'ಟ್ಯಾಕ್ಸಿ' : 'Taxi'}
              </span>
              <span className="text-[10px] text-gray-400">
                {isKannada ? 'ಪ್ರೈಮ್ & ಮಿನಿ ಕ್ಯಾಬ್ಸ್' : 'Sedan & Mini Cabs'}
              </span>
            </div>
          </div>

          {/* 2. AUTO CARD */}
          <div 
            onClick={() => toggleService('auto')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[125px] ${
              selectedServices.auto
                ? 'bg-[#181820] border-white/60 shadow-lg ring-1 ring-white/20'
                : 'bg-[#101014] border-white/10 opacity-60'
            }`}
          >
            {/* Top checkmark */}
            <div className="flex justify-end">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                selectedServices.auto ? 'bg-white text-black font-black' : 'border border-white/20'
              }`}>
                {selectedServices.auto && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>

            {/* Icon and label */}
            <div className="flex flex-col gap-1 mt-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm">
                🛺
              </div>
              <span className="text-sm font-black text-white mt-1">
                Auto
              </span>
              <span className="text-[10px] text-gray-400">
                {isKannada ? 'ನಮ್ಮ ಆಟೋ ಮೀಟರ್ ರೇಟ್' : 'Standard Auto Rickshaw'}
              </span>
            </div>
          </div>

          {/* 3. PACKAGE / ಪ್ಯಾಕೇಜ್ CARD (With "ಹೊಸದು" / NEW badge) */}
          <div 
            onClick={() => toggleService('package')}
            className={`col-span-2 sm:col-span-1 p-4 rounded-3xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[125px] ${
              selectedServices.package
                ? 'bg-[#181820] border-white/60 shadow-lg ring-1 ring-white/20'
                : 'bg-[#101014] border-white/10 opacity-60'
            }`}
          >
            {/* Top row with NEW badge & Checkbox */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {isKannada ? 'ಹೊಸದು' : 'NEW'}
              </span>

              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                selectedServices.package ? 'bg-white text-black font-black' : 'border border-white/20'
              }`}>
                {selectedServices.package && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>

            {/* Icon and label */}
            <div className="flex flex-col gap-1 mt-2">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-sm font-black text-white mt-1">
                {isKannada ? 'ಪ್ಯಾಕೇಜ್' : 'Package'}
              </span>
              <span className="text-[10px] text-gray-400">
                {isKannada ? 'ತ್ವರಿತ ಪಾರ್ಸೆಲ್ ಮತ್ತು ಕೊರಿಯರ್' : 'Express parcel delivery'}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION: TRIP FILTERS & ADD-ONS (Screenshot 4) */}
      <div className="flex flex-col gap-2.5 mt-2">
        <h2 className="text-base font-black text-white tracking-wide">
          {isKannada ? 'ಟ್ರಿಪ್ ಫಿಲ್ಟರ್‌ಗಳು ಮತ್ತು ಆಡ್-ಆನ್‌ಗಳು' : 'Trip Filters & Add-ons'}
        </h2>

        {/* Area Preferences Card */}
        <div className="glass-card p-4 rounded-3xl border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isKannada ? 'ಪ್ರದೇಶದ ಆದ್ಯತೆಗಳು' : 'Destination / Area Preference'}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {isKannada ? 'ನಿಮ್ಮ ಮನೆಗೆ ಹೋಗುವ ದಾರಿಯಲ್ಲಿ ಸವಾರಿಗಳನ್ನು ಪಡೆಯಿರಿ' : 'Get trips heading toward your route'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const next = !destEnabled;
                setDestEnabled(next);
                if (!next) {
                  onUpdateDestination?.({ enabled: false, destination: null });
                }
              }}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                destEnabled ? 'bg-blue-600' : 'bg-white/20'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                destEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Destination input form */}
          {destEnabled && (
            <form onSubmit={handleSaveDestination} className="flex flex-col gap-2.5 pt-2 border-t border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={destAddress}
                  onChange={(e) => setDestAddress(e.target.value)}
                  placeholder={isKannada ? 'ಉದಾ. ಕನಕಪುರ ರೋಡ್, ಮೆಜೆಸ್ಟಿಕ್...' : 'Enter target area...'}
                  className="w-full bg-[#121216] border border-white/20 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Quick pills for Bengaluru areas */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {popularAreas.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setDestAddress(area.split(' (')[0])}
                    className="touch-target text-[10px] font-bold px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-all"
                  >
                    {area}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                {savedSuccess && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {isKannada ? 'ಆದ್ಯತೆ ಉಳಿಸಲಾಗಿದೆ!' : 'Saved!'}
                  </span>
                )}
                <button
                  type="submit"
                  className="touch-target ml-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all shadow-md"
                >
                  {isKannada ? 'ಅನ್ವಯಿಸಿ' : 'Apply Filter'}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>

    </div>
  );
}
