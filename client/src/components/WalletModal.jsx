import React, { useState, useEffect } from 'react';
import { Wallet, Plus, CreditCard, ArrowDownLeft, ArrowUpRight, X, CheckCircle, Shield } from 'lucide-react';
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
      setSuccessMsg(`Successfully added $${topupAmount}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to topup:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full rounded-3xl p-6 border border-white/15 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-uber-accent/20 text-uber-accent flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className="text-base font-extrabold text-white">NexRide Wallet</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-uber-accent/25 via-blue-900/20 to-black p-5 rounded-2xl border border-uber-accent/30 flex flex-col gap-1 shadow-lg">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Available Balance</span>
          <p className="text-3xl font-extrabold text-white">${Number(balance).toFixed(2)}</p>
          <div className="flex items-center gap-1 text-[11px] text-blue-300 font-semibold mt-1">
            <Shield className="w-3.5 h-3.5 text-uber-green" /> 100% Encrypted In-App Payments
          </div>
        </div>

        {/* Top-Up Presets */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add Funds</span>
          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100].map((amt) => (
              <button
                key={amt}
                onClick={() => setTopupAmount(amt)}
                className={`py-2.5 rounded-xl font-extrabold text-xs transition-all border ${
                  topupAmount === amt
                    ? 'bg-uber-accent text-white border-uber-accent shadow-md shadow-uber-accent/30'
                    : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/5'
                }`}
              >
                +${amt}
              </button>
            ))}
          </div>

          <button
            onClick={handleTopup}
            disabled={loading}
            className="mt-2 w-full py-3 rounded-xl bg-uber-accent hover:bg-uber-accentHover font-extrabold text-white text-xs shadow-lg shadow-uber-accent/25 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{loading ? 'Processing...' : `Add $${topupAmount} to Wallet`}</span>
          </button>

          {successMsg && (
            <p className="text-xs text-uber-green font-bold text-center flex items-center justify-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> {successMsg}
            </p>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Activity</span>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {transactions.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No transactions recorded</p>
            ) : (
              transactions.map((tx) => {
                const isDeposit = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isDeposit ? 'bg-uber-green/20 text-uber-green' : 'bg-white/10 text-gray-300'
                        }`}
                      >
                        {isDeposit ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white truncate max-w-[190px]">{tx.description}</p>
                        <span className="text-[10px] text-gray-500">
                          {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <span className={`font-extrabold ${isDeposit ? 'text-uber-green' : 'text-white'}`}>
                      {isDeposit ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
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
