import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  Calendar, 
  Clock, 
  Download, 
  CreditCard, 
  ChevronRight, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  X,
  PieChart
} from 'lucide-react';

export default function DriverEarningsTab({
  driver,
  earningsData,
  range = 'week',
  onChangeRange,
  onCashout,
  onOpenStatement,
  loading = false,
  error = null,
  currentLanguage = 'kn'
}) {
  const isKannada = currentLanguage === 'kn';

  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutMethod, setCashoutMethod] = useState('INSTANT_UPI');
  const [cashoutSuccess, setCashoutSuccess] = useState(null);

  const summary = earningsData?.summary || {
    totalNet: 1840.50,
    totalGross: 1980.00,
    cashEarnings: 450.00,
    onlineEarnings: 1390.50,
    walletBalance: driver?.walletBalance || 840.00,
    tripsCount: 14
  };

  const chartData = earningsData?.chartData || [
    { day: 'Mon', amount: 340 },
    { day: 'Tue', amount: 480 },
    { day: 'Wed', amount: 290 },
    { day: 'Thu', amount: 510 },
    { day: 'Fri', amount: 620 },
    { day: 'Sat', amount: 750 },
    { day: 'Sun', amount: 480 }
  ];

  const trips = earningsData?.trips || [];
  const payouts = earningsData?.payouts || [];

  const maxAmount = Math.max(...chartData.map((d) => d.amount || 0), 200);

  const handleCashoutSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(cashoutAmount) || summary.walletBalance;
    if (amt <= 0 || amt > summary.walletBalance) return;
    
    onCashout(amt, cashoutMethod);
    setCashoutSuccess(isKannada ? `₹${amt.toFixed(2)} ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ!` : `Successfully transferred ₹${amt.toFixed(2)} to your bank!`);
    setTimeout(() => {
      setCashoutSuccess(null);
      setShowCashoutModal(false);
      setCashoutAmount('');
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-3 pb-24 w-full max-w-md mx-auto animate-in fade-in text-white">
      
      {/* 1. WALLET BALANCE & INSTANT CASHOUT HERO */}
      <div className="glass-card p-5 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#121218] to-[#181824]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              {isKannada ? 'ಹಿಂಪಡೆಯಲು ಲಭ್ಯವಿರುವ ಮೊತ್ತ' : 'Available For Payout'}
            </span>
            <h2 className="text-3xl font-black text-white mt-0.5">
              ₹{summary.walletBalance?.toFixed(2)}
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isKannada ? 'ತಕ್ಷಣದ ಬ್ಯಾಂಕ್ / UPI ವರ್ಗಾವಣೆ ಸಕ್ರಿಯ' : 'Instant Bank / UPI Payout eligible'}</span>
            </p>
          </div>

          <button
            onClick={() => setShowCashoutModal(true)}
            className="touch-target px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>{isKannada ? 'ಖಾತೆಗೆ ವರ್ಗಾಯಿಸಿ' : 'Cash Out'}</span>
          </button>
        </div>

        {/* Cash vs Online Split bar */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              {isKannada ? 'ನಗದು (Cash)' : 'Cash'}: <strong className="text-white">₹{summary.cashEarnings?.toFixed(2)}</strong>
            </span>
            <span className="text-gray-400">
              {isKannada ? 'ಆನ್‌ಲೈನ್ (UPI)' : 'Online'}: <strong className="text-white">₹{summary.onlineEarnings?.toFixed(2)}</strong>
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
            <div 
              className="bg-amber-400 h-full transition-all" 
              style={{ width: `${(summary.cashEarnings / (summary.totalNet || 1)) * 100}%` }}
              title="Cash Earnings"
            />
            <div 
              className="bg-emerald-400 h-full transition-all" 
              style={{ width: `${(summary.onlineEarnings / (summary.totalNet || 1)) * 100}%` }}
              title="Online Earnings"
            />
          </div>
        </div>
      </div>

      {/* 2. TIME RANGE SELECTOR & STATEMENT DOWNLOAD */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
          {['day', 'week', 'month'].map((r) => (
            <button
              key={r}
              onClick={() => onChangeRange?.(r)}
              className={`touch-target px-3 py-1 text-xs font-black rounded-xl uppercase transition-all ${
                range === r 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {r === 'day' ? (isKannada ? 'ಇಂದು' : 'Day') : r === 'week' ? (isKannada ? 'ವಾರ' : 'Week') : (isKannada ? 'ತಿಂಗಳು' : 'Month')}
            </button>
          ))}
        </div>

        <button
          onClick={onOpenStatement}
          className="touch-target px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1.5 transition-all"
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>{isKannada ? 'ರಶೀದಿ ಡೌನ್‌ಲೋಡ್' : 'Statement'}</span>
        </button>
      </div>

      {/* 3. EARNINGS BAR CHART */}
      <div className="glass-card p-4 rounded-3xl border border-white/10 shadow-xl flex flex-col gap-3 bg-[#121218]">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
            {isKannada ? 'ಗಳಿಕೆಯ ಟ್ರೆಂಡ್' : 'Earnings Breakdown'}
          </h3>
          <span className="text-xs font-black text-emerald-400">
            {isKannada ? `ಒಟ್ಟು: ₹${summary.totalNet?.toFixed(2)}` : `Total: ₹${summary.totalNet?.toFixed(2)}`}
          </span>
        </div>

        <div className="h-32 flex items-end justify-between gap-2 pt-4 px-1">
          {chartData.map((item, idx) => {
            const heightPercent = Math.min(Math.max((item.amount / maxAmount) * 100, 10), 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                {/* Tooltip */}
                <span className="absolute -top-7 px-1.5 py-0.5 rounded bg-black/90 text-[10px] font-mono text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  ₹{item.amount}
                </span>
                
                {/* Bar */}
                <div 
                  className="w-full rounded-xl bg-gradient-to-t from-blue-600/60 to-emerald-400 transition-all group-hover:brightness-125"
                  style={{ height: `${heightPercent}%` }}
                />
                
                {/* Label */}
                <span className="text-[10px] font-bold text-gray-400">
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. RECENT TRIPS & BREAKDOWN */}
      <div className="glass-card p-4 rounded-3xl border border-white/10 shadow-xl flex flex-col gap-3 bg-[#121218]">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
          {isKannada ? 'ಇತ್ತೀಚಿನ ಸವಾರಿಗಳು (Recent Trips)' : 'Recent Trips'}
        </h3>

        <div className="flex flex-col divide-y divide-white/5">
          {trips.length > 0 ? (
            trips.map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{t.pickup}</span>
                    <span className="text-gray-500">→</span>
                    <span>{t.destination}</span>
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(t.date).toLocaleDateString()} • {t.distanceKm} km • {t.paymentMethod}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-400">
                    ₹{t.driverNet?.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-xs text-gray-500">
              {isKannada ? 'ಇತ್ತೀಚಿನ ಸವಾರಿಗಳು ಲಭ್ಯವಿಲ್ಲ' : 'No recent trips yet'}
            </div>
          )}
        </div>
      </div>

      {/* CASHOUT MODAL */}
      {showCashoutModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-5 border border-white/20 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 bg-[#121218]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">
                {isKannada ? 'ಬ್ಯಾಂಕ್ ಅಥವಾ UPI ಗೆ ವರ್ಗಾಯಿಸಿ' : 'Instant Cash Out'}
              </h3>
              <button 
                onClick={() => setShowCashoutModal(false)}
                className="touch-target p-1 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cashoutSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 text-center font-bold text-xs flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />
                <span>{cashoutSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleCashoutSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">
                    {isKannada ? 'ವರ್ಗಾವಣೆ ಮೊತ್ತ (₹)' : 'Amount (₹)'}
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2.5 font-bold text-gray-400">₹</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      max={summary.walletBalance}
                      value={cashoutAmount}
                      onChange={(e) => setCashoutAmount(e.target.value)}
                      placeholder={summary.walletBalance.toString()}
                      className="w-full bg-[#181820] border border-white/20 rounded-xl pl-7 pr-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    {isKannada ? `ಲಭ್ಯವಿದೆ: ₹${summary.walletBalance.toFixed(2)}` : `Available balance: ₹${summary.walletBalance.toFixed(2)}`}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">
                    {isKannada ? 'ವರ್ಗಾವಣೆ ವಿಧಾನ' : 'Payout Destination'}
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setCashoutMethod('INSTANT_UPI')}
                      className={`touch-target p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                        cashoutMethod === 'INSTANT_UPI' 
                          ? 'bg-emerald-500/20 border-emerald-400 text-white' 
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      <span className="block font-black">UPI ID</span>
                      <span className="text-[9px] opacity-75">shekar@okhdfc</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashoutMethod('INSTANT_BANK')}
                      className={`touch-target p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                        cashoutMethod === 'INSTANT_BANK' 
                          ? 'bg-emerald-500/20 border-emerald-400 text-white' 
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      <span className="block font-black">Bank IMPS</span>
                      <span className="text-[9px] opacity-75">HDFC ••••4892</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="touch-target w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all shadow-lg shadow-emerald-500/30 mt-2"
                >
                  {isKannada ? 'ತಕ್ಷಣ ವರ್ಗಾಯಿಸಿ' : 'Confirm Instant Cashout'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
