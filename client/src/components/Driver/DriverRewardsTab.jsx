import React, { useState } from 'react';
import { 
  Sparkles, 
  Gift, 
  Award, 
  Coins, 
  Flame, 
  ChevronDown, 
  Check, 
  X, 
  Star, 
  ArrowRight,
  TrendingUp,
  Share2
} from 'lucide-react';
import { sound } from '../../utils/audio';

export default function DriverRewardsTab({
  driver,
  currentLanguage = 'kn',
  onClaimBonus
}) {
  const isKannada = currentLanguage === 'kn';

  const [gemsCount, setGemsCount] = useState(120);
  const [showScratchModal, setShowScratchModal] = useState(false);
  const [isScratched, setIsScratched] = useState(false);
  const [scratchReward, setScratchReward] = useState(25);
  const [claimed, setClaimed] = useState(false);

  const handleStartScratch = () => {
    // Generate reward between 10 and 50
    const rewards = [10, 20, 25, 30, 50];
    const picked = rewards[Math.floor(Math.random() * rewards.length)];
    setScratchReward(picked);
    setIsScratched(false);
    setClaimed(false);
    setShowScratchModal(true);
  };

  const handleReveal = () => {
    setIsScratched(true);
    try { sound.playTripCompleted(); } catch (e) {}
  };

  const handleClaim = () => {
    setClaimed(true);
    setGemsCount(prev => prev + 50);
    onClaimBonus?.(scratchReward);
    setTimeout(() => {
      setShowScratchModal(false);
      setClaimed(false);
      setIsScratched(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-4 pb-28 w-full max-w-md mx-auto text-white animate-in fade-in">
      
      {/* 1. TOP TODAY'S EARNINGS SUMMARY PILL (Screenshot 7) */}
      <div className="p-3.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white">
            {isKannada ? 'ಇಂದಿನ ಅರ್ನಿಂಗ್ಸ್' : "Today's Earnings"}
          </span>
          <span className="text-xl font-black text-blue-400">
            ₹{driver?.earningsToday || 184}
          </span>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </div>

      {/* 2. HORIZONTAL SCROLL REWARD CHIPS (Screenshot 7) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
        
        {/* Gems Chip */}
        <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-gradient-to-b from-[#181824] to-[#12121a] border border-blue-500/30 min-w-[76px] shrink-0 text-center shadow-md">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 text-lg">
              💎
            </div>
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-purple-600 text-[10px] font-black">
              {gemsCount}
            </span>
          </div>
          <span className="text-[11px] font-bold text-gray-200 mt-1">
            {isKannada ? 'ಜೆಮ್ಸ್' : 'Gems'}
          </span>
        </div>

        {/* Bundle Order Chip */}
        <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#181824] border border-white/10 min-w-[82px] shrink-0 text-center shadow-md">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-lg">
              🛺
            </div>
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-[9px] font-black">
              +2
            </span>
          </div>
          <span className="text-[10px] font-bold text-gray-200 mt-1">
            {isKannada ? 'ಬಂಡಲ್ ಆರ್ಡರ್' : 'Bundle'}
          </span>
        </div>

        {/* Extra Rewards Chip */}
        <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#181824] border border-white/10 min-w-[86px] shrink-0 text-center shadow-md">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-lg">
            🎁
          </div>
          <span className="text-[10px] font-bold text-gray-200 mt-1">
            {isKannada ? 'ಹೆಚ್ಚುವರಿ ಬಹುಮಾನ' : 'Rewards'}
          </span>
        </div>

        {/* Earn 2000 Refer Chip */}
        <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#181824] border border-white/10 min-w-[82px] shrink-0 text-center shadow-md">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs">
            ₹2k
          </div>
          <span className="text-[10px] font-bold text-gray-200 mt-1">
            Earn 2000
          </span>
        </div>

        {/* Majestic Lounge Chip */}
        <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#181824] border border-white/10 min-w-[86px] shrink-0 text-center shadow-md">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 text-lg">
            ☕
          </div>
          <span className="text-[10px] font-bold text-gray-200 mt-1">
            Lounge
          </span>
        </div>

      </div>

      {/* 3. SECTION: EXCLUSIVE FOR YOU / ನಿಮಗಾಗಿ ಮಾತ್ರ (Screenshot 7) */}
      <div className="flex flex-col gap-3 mt-1">
        <div className="flex items-center justify-center gap-2 text-amber-300 font-serif tracking-widest text-xs uppercase">
          <span>~ ✦ ~</span>
          <span className="font-bold font-sans">
            {isKannada ? 'ನಿಮಗಾಗಿ ಮಾತ್ರ' : 'Exclusive For You'}
          </span>
          <span>~ ✦ ~</span>
        </div>

        {/* BIG INSTANT CASH REWARD HERO CARD (Screenshot 7) */}
        <div className="relative rounded-3xl overflow-hidden p-6 bg-gradient-to-b from-[#0b1437] via-[#090d24] to-[#040612] border border-blue-500/30 shadow-2xl flex flex-col items-center text-center">
          
          {/* Ambient Glows */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/25 rounded-full blur-3xl pointer-events-none" />
          
          <h2 className="text-xl font-black text-amber-300 relative z-10 leading-tight">
            Instant cash reward in
          </h2>
          <div className="text-4xl font-black text-white mt-1 relative z-10">
            1 min •
          </div>

          {/* Glowing Scratch Card Graphics */}
          <div className="relative my-6 w-full max-w-[240px] h-36 flex items-center justify-center">
            {/* Background card 1 */}
            <div className="absolute -left-2 w-28 h-32 rounded-2xl bg-blue-700/60 border border-blue-400/40 rotate-[-12deg] p-2 flex flex-col justify-between shadow-lg opacity-80">
              <span className="text-[9px] font-bold text-blue-200">You Won</span>
              <div className="text-base font-black text-white">₹15</div>
            </div>

            {/* Background card 2 */}
            <div className="absolute -right-2 w-28 h-32 rounded-2xl bg-indigo-700/60 border border-indigo-400/40 rotate-[12deg] p-2 flex flex-col justify-between shadow-lg opacity-80">
              <span className="text-[9px] font-bold text-indigo-200">You Won</span>
              <div className="text-base font-black text-white">₹50</div>
            </div>

            {/* Foreground card */}
            <div className="relative z-10 w-32 h-36 rounded-2xl bg-gradient-to-b from-blue-600 to-indigo-900 border-2 border-blue-300/60 p-3 flex flex-col justify-between shadow-2xl animate-pulse">
              <span className="text-[10px] font-black text-blue-100 uppercase tracking-wide">
                You Won
              </span>
              <div className="flex flex-col items-center justify-center my-auto">
                <span className="text-2xl font-black text-white">₹{scratchReward}</span>
                <span className="text-[9px] text-blue-200 font-bold">Instant Credit</span>
              </div>
              <div className="w-full h-1 rounded-full bg-blue-400/40" />
            </div>

            {/* Floating Gold Coin */}
            <div className="absolute -bottom-2 left-4 z-20 w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-amber-200 flex items-center justify-center shadow-lg font-black text-black text-sm">
              ₹
            </div>
          </div>

          {/* TAP TO EARN BUTTON (Screenshot 7) */}
          <button
            onClick={handleStartScratch}
            className="touch-target w-full max-w-xs py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black text-sm font-black tracking-wide shadow-xl shadow-amber-400/20 active:scale-95 transition-all relative z-10"
          >
            {isKannada ? 'ಗಳಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ' : 'Tap to earn'}
          </button>

        </div>
      </div>

      {/* 4. INTERACTIVE SCRATCH REVEAL MODAL */}
      {showScratchModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-xs w-full rounded-3xl p-5 border border-white/20 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 bg-[#121218]">
            <div className="w-full flex justify-end">
              <button onClick={() => setShowScratchModal(false)} className="touch-target p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-base font-black text-white mt-1">
              {isKannada ? 'ಲಕ್ಕಿ ಸ್ಕ್ರ್ಯಾಚ್ ಕಾರ್ಡ್' : 'Lucky Scratch Card'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isKannada ? 'ಬೋನಸ್ ಬಹಿರಂಗಪಡಿಸಲು ಕಾರ್ಡ್ ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿ' : 'Tap card to scratch & reveal bonus'}
            </p>

            <div 
              onClick={handleReveal}
              className={`w-44 h-48 rounded-2xl my-4 flex flex-col items-center justify-center p-4 cursor-pointer transition-all shadow-xl ${
                isScratched 
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-700 border-2 border-emerald-300 text-white animate-in zoom-in'
                  : 'bg-gradient-to-tr from-amber-500 to-yellow-600 border-2 border-yellow-300 text-black hover:scale-105'
              }`}
            >
              {isScratched ? (
                <>
                  <Sparkles className="w-8 h-8 text-yellow-300 animate-spin" />
                  <span className="text-xs uppercase font-extrabold mt-2 text-emerald-100">
                    {isKannada ? 'ನೀವು ಗೆದ್ದಿದ್ದೀರಿ!' : 'You Won!'}
                  </span>
                  <span className="text-4xl font-black text-white my-1">
                    ₹{scratchReward}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-200">
                    {isKannada ? 'ವಾಲೆಟ್‌ಗೆ ಜಮೆಯಾಗಿದೆ' : 'Credited to Wallet'}
                  </span>
                </>
              ) : (
                <>
                  <Gift className="w-10 h-10 text-black/70 animate-bounce" />
                  <span className="text-sm font-black mt-2">
                    {isKannada ? 'ಸ್ಕ್ರ್ಯಾಚ್ ಮಾಡಿ!' : 'Tap to Scratch!'}
                  </span>
                  <span className="text-[10px] font-bold opacity-75 mt-1">
                    Up to ₹50
                  </span>
                </>
              )}
            </div>

            {isScratched && (
              <button
                onClick={handleClaim}
                disabled={claimed}
                className="touch-target w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                {claimed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                <span>{claimed ? (isKannada ? 'ಜಮೆಯಾಗಿದೆ!' : 'Claimed!') : (isKannada ? 'ಬಹುಮಾನ ಸ್ವೀಕರಿಸಿ' : 'Collect Reward')}</span>
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
