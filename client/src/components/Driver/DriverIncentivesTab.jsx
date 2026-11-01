import React, { useState } from 'react';
import { 
  Award, 
  Flame, 
  Gift, 
  Clock, 
  CheckCircle, 
  Copy, 
  Check, 
  Sparkles, 
  Zap,
  TrendingUp,
  Share2
} from 'lucide-react';

export default function DriverIncentivesTab({
  driver,
  questsData,
  onClaimQuest,
  loading = false
}) {
  const [copied, setCopied] = useState(false);

  const data = questsData || {
    streakDays: 6,
    referralCode: `NEX-${driver?.name?.split(' ')[0]?.toUpperCase() || 'MIKE'}77`,
    referralEarnings: 300,
    referralsCount: 3,
    peakHourBonuses: [
      { time: '08:00 - 11:00 AM', label: 'Morning Rush', bonus: '+$5.00 / trip', status: 'COMPLETED' },
      { time: '05:00 - 09:00 PM', label: 'Evening Peak', bonus: '+$7.50 / trip', status: 'ACTIVE' },
      { time: '11:00 PM - 03:00 AM', label: 'Night Owl Extra', bonus: '+$10.00 / trip', status: 'UPCOMING' }
    ],
    quests: [
      {
        id: 'quest-daily-10',
        title: 'Daily Hero Sprint',
        description: 'Complete 10 rides today between 06:00 - 23:59',
        reward: 35.00,
        current: 7,
        target: 10,
        unit: 'rides',
        expiresIn: '4h 12m',
        completed: false,
        claimed: false
      },
      {
        id: 'quest-peak-5',
        title: 'Peak-Hour Master',
        description: 'Complete 5 trips during 5:00 PM - 9:00 PM peak hours',
        reward: 25.00,
        current: 5,
        target: 5,
        unit: 'rides',
        expiresIn: '2h 45m',
        completed: true,
        claimed: false
      },
      {
        id: 'quest-weekend-25',
        title: 'Weekend Warrior',
        description: 'Complete 25 rides over Friday through Sunday',
        reward: 80.00,
        current: 19,
        target: 25,
        unit: 'rides',
        expiresIn: '1d 6h',
        completed: false,
        claimed: false
      }
    ]
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText?.(data.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col gap-3 pb-24 w-full animate-in fade-in">
      
      {/* 1. DAILY DRIVING STREAK HERO */}
      <div className="glass-card p-5 rounded-3xl border border-orange-500/30 shadow-2xl bg-gradient-to-br from-[#181210] to-[#121216] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-black uppercase tracking-wider mb-0.5">
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
              <span>Consecutive Driving Streak</span>
            </div>
            <h2 className="text-3xl font-black text-white">
              {data.streakDays} Day Streak!
            </h2>
            <p className="text-xs text-gray-300 mt-1">
              Complete at least 1 trip tomorrow to unlock your <span className="text-orange-400 font-bold">$50 streak reward</span>.
            </p>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0 shadow-lg shadow-orange-500/20">
            <Flame className="w-8 h-8 fill-orange-400" />
          </div>
        </div>

        {/* 7-day streak bubbles */}
        <div className="grid grid-cols-7 gap-1.5 mt-4 pt-3 border-t border-white/10">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
            const isDone = idx < data.streakDays;
            const isToday = idx === data.streakDays - 1;
            return (
              <div
                key={idx}
                className={`py-2 rounded-xl flex flex-col items-center justify-center text-center transition-all ${
                  isDone 
                    ? 'bg-orange-500 text-black font-black shadow-md shadow-orange-500/30' 
                    : 'bg-white/5 text-gray-500 font-bold'
                } ${isToday ? 'ring-2 ring-white' : ''}`}
              >
                <span className="text-[10px]">{day}</span>
                <Check className={`w-3 h-3 mt-0.5 ${isDone ? 'stroke-[3]' : 'opacity-20'}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. ACTIVE DRIVER QUESTS */}
      <div className="glass-card p-4 rounded-3xl border border-white/10 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Active Quests & Challenges
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
            {data.quests?.filter((q) => !q.claimed).length} Available
          </span>
        </div>

        <div className="space-y-3">
          {data.quests?.map((quest) => {
            const progressPct = Math.min(100, Math.round((quest.current / quest.target) * 100));
            const isReadyToClaim = quest.completed && !quest.claimed;

            return (
              <div
                key={quest.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2.5 ${
                  isReadyToClaim
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                    : quest.claimed
                      ? 'bg-white/[0.02] border-white/5 opacity-60'
                      : 'bg-black/40 border-white/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      {quest.title}
                      {quest.claimed && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-gray-400">
                          Claimed
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">{quest.description}</p>
                  </div>

                  <span className="text-base font-black text-emerald-400 shrink-0 pl-2">
                    +${quest.reward.toFixed(2)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-400 font-bold">
                    <span>Progress: {quest.current} / {quest.target} {quest.unit}</span>
                    <span>{progressPct}% • Ends in {quest.expiresIn}</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      style={{ width: `${progressPct}%` }}
                      className={`h-full transition-all duration-500 ${
                        quest.completed ? 'bg-emerald-400' : 'bg-purple-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Claim Button */}
                {isReadyToClaim && (
                  <button
                    onClick={() => onClaimQuest(quest.id)}
                    className="touch-target w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-1.5 animate-pulse"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Claim ${quest.reward.toFixed(2)} Bonus Now</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. PEAK-HOUR SURGE BONUSES SCHEDULE */}
      <div className="glass-card p-4 rounded-3xl border border-white/10 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Peak-Hour Extra Payouts
          </h3>
        </div>

        <div className="space-y-2">
          {data.peakHourBonuses?.map((bonus, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-bold text-white block">{bonus.label}</span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-gray-500" /> {bonus.time}
                </span>
              </div>

              <div className="text-right">
                <span className="font-black text-emerald-400 block">{bonus.bonus}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                  bonus.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                    : bonus.status === 'COMPLETED'
                      ? 'bg-white/10 text-gray-400'
                      : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {bonus.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. DRIVER REFERRAL CODE SYSTEM */}
      <div className="glass-card p-4 rounded-3xl border border-white/10 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Driver Referral Program
            </h3>
          </div>
          <span className="text-[10px] font-bold text-pink-400">$100 / Driver</span>
        </div>

        <p className="text-xs text-gray-300">
          Invite fellow drivers to join NexRide. Earn $100 after they complete their first 25 trips.
        </p>

        {/* Code Box */}
        <div className="p-3 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Your Exclusive Referral Code</span>
            <span className="font-mono font-black text-base text-white tracking-widest">{data.referralCode}</span>
          </div>

          <button
            onClick={handleCopyCode}
            className="touch-target px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>

        {/* Referral stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Friends Onboarded</span>
            <p className="text-base font-black text-white mt-0.5">{data.referralsCount} Drivers</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Bonus Earned</span>
            <p className="text-base font-black text-emerald-400 mt-0.5">${data.referralEarnings}.00</p>
          </div>
        </div>
      </div>

    </div>
  );
}
