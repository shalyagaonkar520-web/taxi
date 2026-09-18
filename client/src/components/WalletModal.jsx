import React, { useState, useEffect } from 'react';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, X, CheckCircle, Shield } from 'lucide-react';
import { fetchWallet, topupWallet } from '../services/api';

export default function WalletModal({ user, onClose, onBalanceUpdate }) {
  const [balance, setBalance] = useState(user?.walletBalance || 0);
  const [transactions, setTransactions] = useState([]);
  const [topupAmount, setTopupAmount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadWalletData();
    }
  }, [user]);

  const loadWalletData = async () => {
    try {
      const data = await fetchWallet(user.id);
      setBalance(data.balance);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Failed to load wallet:', err);
    }
  };

  const handleTopup = async () => {
    try {
      setLoading(true);
      const res = await topupWallet(user.id, topupAmount, 'Card (*4242)');
      setBalance(res.balance);
      if (onBalanceUpdate) onBalanceUpdate(res.balance);
      setTransactions((prev) => [res.transaction, ...prev]);
      setSuccessMsg(`Added $${topupAmount} to your wallet.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to topup:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-white dark:bg-[#16161b] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-uber-accent/10 text-uber-accent flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Your wallet</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance */}
        <div className="rounded-2xl bg-uber-accent/10 border border-uber-accent/20 p-5 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-uber-accent">
            Money you have
          </span>
          <p className="text-3xl font-black text-slate-900 dark:text-white">
            ${Number(balance).toFixed(2)}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            <Shield className="w-3.5 h-3.5 text-uber-green shrink-0" /> Payments are safe and encrypted
          </p>
        </div>

        {/* Top up */}
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Add money
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100].map((amt) => (
              <button
                key={amt}
                onClick={() => setTopupAmount(amt)}
                className={`py-3 rounded-xl font-extrabold text-sm transition-all border-2 ${
                  topupAmount === amt
                    ? 'bg-uber-accent/5 text-uber-accent border-uber-accent'
                    : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          <button
            onClick={handleTopup}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-uber-accent hover:bg-uber-accentHover text-white font-extrabold text-sm shadow-lg shadow-uber-accent/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Please wait…' : `Add $${topupAmount}`}
          </button>

          {successMsg && (
            <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-uber-green">
              <CheckCircle className="w-4 h-4" /> {successMsg}
            </p>
          )}
        </div>

        {/* Activity */}
        <div className="flex flex-col gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Recent activity
          </span>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                Nothing here yet.
              </p>
            ) : (
              transactions.map((tx) => {
                const isDeposit = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          isDeposit
                            ? 'bg-uber-green/15 text-uber-green'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isDeposit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(tx.timestamp).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 text-sm font-extrabold ${
                        isDeposit ? 'text-uber-green' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isDeposit
                        ? `+$${tx.amount.toFixed(2)}`
                        : `-$${Math.abs(tx.amount).toFixed(2)}`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
