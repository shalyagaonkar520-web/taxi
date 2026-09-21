import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  Car, 
  Sliders, 
  Calendar, 
  Sparkles, 
  HeartPulse, 
  ShoppingBag, 
  Headphones, 
  Globe, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  Users, 
  ShieldCheck, 
  Gift, 
  Award,
  LogOut,
  AlertTriangle
} from 'lucide-react';

export default function DriverSideDrawer({
  isOpen,
  onClose,
  driver,
  onSelectTab,
  currentLanguage = 'kn',
  onLanguageChange,
  onOpenSOS
}) {
  const [showLangMenu, setShowLangMenu] = useState(false);

  if (!isOpen) return null;

  const isKannada = currentLanguage === 'kn';

  const driverName = driver?.name || 'Shekar kulal n';
  const driverRating = driver?.rating || 4.70;
  const vehicleType = driver?.vehicle?.type || 'Auto';
  const licensePlate = driver?.vehicle?.licensePlate || 'KA-01-EQ-7892';

  const handleNav = (tabId) => {
    onSelectTab?.(tabId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dimmed backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer content sliding in from left */}
      <div className="relative w-[310px] max-w-[85vw] h-full bg-[#111116] text-white flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-250 border-r border-white/10 overflow-y-auto">
        
        {/* TOP BLUE PROFILE HERO (Matching Screenshots 1 & 9) */}
        <div className="p-5 bg-gradient-to-r from-blue-600 to-blue-700 relative text-white">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 touch-target p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 mt-2">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center overflow-hidden shadow-md">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" 
                  alt="Driver Avatar" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://ui-avatars.com/api/?name=Shekar+Kulal&background=2563eb&color=fff';
                  }}
                />
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#111116]" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black truncate tracking-wide uppercase">
                {driverName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  ★ {driverRating.toFixed(2)}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/20 text-white">
                  {vehicleType === 'AUTO' || vehicleType === 'Auto' ? 'ಆಟೋ' : 'ಟ್ಯಾಕ್ಸಿ'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick wallet/coin pill */}
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
            <span className="text-blue-100 font-medium">
              {isKannada ? 'ವಾಹನ ಸಂಖ್ಯೆ' : 'Vehicle No'}:
            </span>
            <span className="font-mono font-bold tracking-wider">{licensePlate}</span>
          </div>
        </div>

        {/* MENU LIST ITEMS (Matching Screenshots 1, 4 & 9) */}
        <div className="flex-1 py-3 px-2 flex flex-col gap-1">

          {/* 1. Earnings / ಆದಾಯ */}
          <button 
            onClick={() => handleNav('earnings')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-lg">
                ₹
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white">
                  {isKannada ? 'ಆದಾಯ / ಗಳಿಕೆ' : 'Earnings'}
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? 'ಹಣವನ್ನು ಬ್ಯಾಂಕ್‌ಗೆ ವರ್ಗಾಯಿಸಿ, ಇತಿಹಾಸ' : 'Instant Bank Cashout, History'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 2. Trips / ಪ್ರವಾಸಗಳು */}
          <button 
            onClick={() => handleNav('earnings')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white">
                  {isKannada ? 'ಪ್ರವಾಸಗಳು' : 'Ride History'}
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? 'ಪೂರ್ಣಗೊಂಡ ಸವಾರಿಗಳು ಮತ್ತು ರಶೀದಿ' : 'Completed trips & fare breakdown'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 3. Preferences / ಆದ್ಯತೆಗಳು (Screenshot 4) */}
          <button 
            onClick={() => handleNav('services')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white">
                  {isKannada ? 'ಆದ್ಯತೆಗಳು / Preferences' : 'Preferences'}
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? 'ಟ್ಯಾಕ್ಸಿ, ಆಟೋ, ಪ್ಯಾಕೇಜ್ ಮೋಡ್' : 'Taxi, Auto, Courier selection'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 4. Plans & Subscriptions / ಯೋಜನೆಗಳು (0% Commission) */}
          <button 
            onClick={() => handleNav('account')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white flex items-center gap-2">
                  <span>{isKannada ? 'ಯೋಜನೆಗಳು (0% ಪಾಸ್)' : 'Subscription Plans'}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    NEW
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? '₹0 ಕಮಿಷನ್‌ನಲ್ಲಿ ರೈಡ್ ಮಾಡಿ' : 'Zero commission daily pass'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 5. Rewards & Benefits / ಪ್ರಯೋಜನಗಳು & ಮೈಲ್ಸ್ ಬೋನಸ್ */}
          <button 
            onClick={() => handleNav('rewards')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white flex items-center gap-2">
                  <span>{isKannada ? 'ಪ್ರಯೋಜನಗಳು & ರಿವಾರ್ಡ್ಸ್' : 'Rewards & Scratch Cards'}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">
                    WIN ₹
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? 'ಇನ್‌ಸ್ಟಂಟ್ ಕ್ಯಾಶ್, ಜೆಮ್ಸ್ ಬೋನಸ್' : 'Instant cash rewards, gems'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 6. Health & Wellness / ಆರೋಗ್ಯ */}
          <button 
            onClick={() => handleNav('account')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white">
                  {isKannada ? 'ಆರೋಗ್ಯ & ವಿಮೆ' : 'Health & Insurance'}
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? 'ಆಕ್ಸಿಡೆಂಟ್ & ಕುಟುಂಬ ಕವರೇಜ್' : 'Accident & family medical cover'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 7. Store / ಸ್ಟೋರ್ */}
          <button 
            onClick={() => handleNav('account')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white">
                  {isKannada ? 'ಸ್ಟೋರ್ / Store' : 'Partner Gear Store'}
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? 'ಕ್ಯಾಬ್ ಆಕ್ಸೆಸರೀಸ್ ಮತ್ತು ಡ್ಯಾಶ್‌ಕ್ಯಾಮ್' : 'Mobile mounts, dashcams, uniforms'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 8. Help / ಸಹಾಯ */}
          <button 
            onClick={() => handleNav('account')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white">
                  {isKannada ? 'ಸಹಾಯ / Partner Care' : 'Help & Support'}
                </div>
                <div className="text-[11px] text-gray-400">
                  {isKannada ? '24x7 ಸಪೋರ್ಟ್ ಪಡೆಯಿರಿ' : '24x7 call & ticket resolution'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 9. Refer & Earn / ಸ್ನೇಹಿತರನ್ನು ರೆಫರ್ ಮಾಡಿ */}
          <button 
            onClick={() => handleNav('account')}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/15 text-yellow-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-100 group-hover:text-white">
                  {isKannada ? 'ಸ್ನೇಹಿತರನ್ನು ರೆಫರ್ ಮಾಡಿ' : 'Refer a Driver'}
                </div>
                <div className="text-[11px] text-yellow-400 font-bold">
                  {isKannada ? '₹250 - ₹2000 ವರೆಗೆ ಗಳಿಸಿ' : 'Earn ₹250 to ₹2000 bonus'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </button>

          {/* 10. SOS Emergency Shortcut */}
          <button 
            onClick={() => {
              onOpenSOS?.();
              onClose();
            }}
            className="touch-target w-full flex items-center justify-between p-3 rounded-2xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all text-left mt-1"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-red-400">
                  {isKannada ? 'SOS ತುರ್ತು ಕರೆ' : 'SOS Emergency Alert'}
                </div>
                <div className="text-[11px] text-red-300/80">
                  {isKannada ? 'ಪೊಲೀಸ್ & ಅಡ್ಮಿನ್ ಲೈವ್ ಅಲರ್ಟ್' : 'Instant police & control room ping'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400" />
          </button>

        </div>

        {/* BOTTOM SECTION: PROMO BANNER & NATIVE LANGUAGE SELECTOR (Screenshots 1 & 9) */}
        <div className="p-3 border-t border-white/10 bg-[#0d0d12] flex flex-col gap-2">
          
          {/* Promo banner matching Screenshot 1 */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/20 text-xs">
            <p className="text-amber-200 font-bold text-[11px] leading-relaxed">
              {isKannada 
                ? 'ಹೊಸ ವೆಹಿಕಲ್ ನಂಬರ್ ಪಡೆಯಿರಿ, NexRide ಗೆ ಸೇರಿಸಿ, ರಿವಾರ್ಡ್ ಗೆಲ್ಲಿ'
                : 'Add a new vehicle number to NexRide and win special rewards!'}
            </p>
          </div>

          {/* Native Language Selector (Screenshot 9: "文A ಕನ್ನಡ ⏶") */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="touch-target w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-400 text-sm">文A</span>
                <span>{isKannada ? 'ಕನ್ನಡ (Kannada)' : 'English (EN)'}</span>
              </div>
              {showLangMenu ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLangMenu && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-[#1e1e24] border border-white/20 rounded-xl overflow-hidden shadow-2xl z-30">
                <button
                  onClick={() => {
                    onLanguageChange?.('kn');
                    setShowLangMenu(false);
                  }}
                  className={`touch-target w-full px-3 py-2.5 text-left text-xs font-bold flex items-center justify-between ${
                    isKannada ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span>ಕನ್ನಡ (Kannada)</span>
                  {isKannada && <span>✓</span>}
                </button>
                <button
                  onClick={() => {
                    onLanguageChange?.('en');
                    setShowLangMenu(false);
                  }}
                  className={`touch-target w-full px-3 py-2.5 text-left text-xs font-bold flex items-center justify-between ${
                    !isKannada ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span>English (English)</span>
                  {!isKannada && <span>✓</span>}
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
