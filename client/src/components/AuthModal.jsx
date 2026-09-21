import React, { useState } from 'react';
import { User, Shield, Car, Key, CheckCircle2, AlertCircle, X } from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    role: 'RIDER',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    password: 'rider123',
    icon: User,
    color: 'border-blue-500/40 hover:border-blue-500 bg-blue-500/10 text-blue-400',
    description: 'Book rides, real-time map, wallet top-up, trip ratings'
  },
  {
    role: 'DRIVER',
    name: 'Michael Rodriguez',
    email: 'michael.driver@example.com',
    password: 'driver123',
    icon: Car,
    color: 'border-emerald-500/40 hover:border-emerald-500 bg-emerald-500/10 text-emerald-400',
    description: '15s acceptance window, turn-by-turn HUD, PIN start'
  },
  {
    role: 'ADMIN',
    name: 'Dispatch Commander',
    email: 'admin@nexride.app',
    password: 'admin123',
    icon: Shield,
    color: 'border-purple-500/40 hover:border-purple-500 bg-purple-500/10 text-purple-400',
    description: 'God-view fleet tracking, revenue analytics, surge sliders'
  }
];

export default function AuthModal({
  isOpen,
  onClose,
  targetRole = null,
  onLoginSuccess
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleLogin = async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('nexride_token', data.token);
      localStorage.setItem('nexride_user', JSON.stringify(data.user));

      if (onLoginSuccess) {
        onLoginSuccess(data.user, data.token);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-[#121216] border border-white/10 rounded-3xl p-6 shadow-2xl relative text-white">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 touch-target text-gray-400 hover:text-white rounded-full p-2 bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-1">NexRide Security</p>
          <h2 className="text-2xl font-bold tracking-tight">Account Authentication</h2>
          <p className="text-xs text-gray-400 mt-1">
            Sign in with your credentials or select a pre-seeded demo profile.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Fast Seeded Accounts */}
        <div className="space-y-2 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Quick 1-Click Demo Profiles
          </p>
          {DEMO_ACCOUNTS.map((acc) => {
            const Icon = acc.icon;
            const isTarget = targetRole && acc.role === targetRole;
            return (
              <button
                key={acc.role}
                onClick={() => handleLogin({ email: acc.email, password: acc.password })}
                disabled={loading}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 touch-target ${
                  acc.color
                } ${isTarget ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
              >
                <div className="p-2 rounded-xl bg-white/10 shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">{acc.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10">
                      {acc.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{acc.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Manual Credentials Form */}
        <div className="relative flex items-center justify-center my-4">
          <div className="w-full border-t border-white/10" />
          <span className="absolute px-3 bg-[#121216] text-[10px] uppercase tracking-wider text-gray-500">
            Or Login with Email
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin({ email, password });
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full touch-target mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>Authenticate & Enter</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
