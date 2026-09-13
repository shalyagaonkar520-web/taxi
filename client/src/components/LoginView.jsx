import React, { useState } from 'react';
import { ArrowRight, Car, ShieldCheck, Radio } from 'lucide-react';
import { loginUser } from '../services/api';

const ROLE_COPY = {
  RIDER: { label: 'Rider', icon: Car, accent: 'bg-uber-accent', hint: 'Book a ride around your city.' },
  DRIVER: { label: 'Driver', icon: Radio, accent: 'bg-uber-green', hint: 'Manage trips, status, and earnings.' },
  ADMIN: { label: 'Admin', icon: ShieldCheck, accent: 'bg-purple-600', hint: 'Monitor dispatch and platform health.' }
};

export default function LoginView({ role, onLogin }) {
  const [email, setEmail] = useState(role === 'ADMIN' ? 'admin@nexride.com' : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const copy = ROLE_COPY[role];
  const Icon = copy.icon;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginUser(email, password, role);
      onLogin(user);
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-panel border border-white/10 rounded-3xl p-7 shadow-2xl">
        <div className={`w-12 h-12 ${copy.accent} rounded-2xl flex items-center justify-center mb-6`}>
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">NexRide</p>
        <h1 className="text-3xl font-black tracking-tight">{copy.label} sign in</h1>
        <p className="text-sm text-gray-400 mt-2 mb-7">{copy.hint}</p>

        <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/40 mb-4" />
        <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="password">Password</label>
        <input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/40 mb-5" />

        {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">{error}</p>}
        <button type="submit" disabled={loading} className={`w-full ${copy.accent} rounded-xl px-4 py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-60`}>
          {loading ? 'Signing in...' : 'Sign in'} {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
        <a href="/" className="block text-center text-xs text-gray-500 hover:text-white mt-5">Back to workspace selection</a>
      </form>
    </main>
  );
}