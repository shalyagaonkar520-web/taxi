import React, { useState } from 'react';
import { ArrowRight, Car, ShieldCheck, Radio, Chrome, KeyRound } from 'lucide-react';
import { loginUser, loginWithFirebaseToken } from '../services/api';
import { firebaseEnabled, getFirebaseToken, sendFirebasePasswordReset, signInWithFirebase, signInWithGoogle, signUpWithFirebase } from '../services/firebaseAuth';

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
  const [mode, setMode] = useState('signin');
  const copy = ROLE_COPY[role];
  const Icon = copy.icon;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user;
      if (firebaseEnabled) {
        if (mode === 'signup' && role === 'ADMIN') throw new Error('Admin accounts are created by the owner only');
        const credential = mode === 'signup'
          ? await signUpWithFirebase(email, password)
          : await signInWithFirebase(email, password);
        user = await loginWithFirebaseToken(await getFirebaseToken(credential.user), role, {
          name: credential.user.displayName,
          picture: credential.user.photoURL
        });
      } else {
        if (mode === 'signup') throw new Error('Sign-up requires Firebase configuration');
        user = await loginUser(email, password, role);
      }
      onLogin(user);
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      if (role === 'ADMIN') {
        const credential = await signInWithGoogle();
        const user = await loginWithFirebaseToken(await getFirebaseToken(credential.user), role, {
          name: credential.user.displayName,
          picture: credential.user.photoURL
        });
        onLogin(user);
      } else {
        const credential = await signInWithGoogle();
        const user = await loginWithFirebaseToken(await getFirebaseToken(credential.user), role, {
          name: credential.user.displayName,
          picture: credential.user.photoURL
        });
        onLogin(user);
      }
    } catch (loginError) {
      setError(loginError.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!firebaseEnabled) {
      setError('Forgot password requires Firebase configuration');
      return;
    }
    try {
      await sendFirebasePasswordReset(email);
      setError('Password reset email sent. Check your inbox.');
    } catch (resetError) {
      setError(resetError.message || 'Could not send password reset email');
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md glass-panel border border-white/10 rounded-3xl p-7 shadow-2xl">
        <div className={`w-12 h-12 ${copy.accent} rounded-2xl flex items-center justify-center mb-6`}>
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">NexRide</p>
        <h1 className="text-3xl font-black tracking-tight">{copy.label} {mode === 'signup' ? 'sign up' : 'sign in'}</h1>
        <p className="text-sm text-gray-400 mt-2 mb-7">{copy.hint}</p>

        <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/40 mb-4" />
        <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="password">Password</label>
        <input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/40 mb-5" />

        {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">{error}</p>}
        <button type="submit" disabled={loading} className={`w-full ${copy.accent} rounded-xl px-4 py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-60`}>
          {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'} {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
        {firebaseEnabled && (
          <>
            <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full mt-3 rounded-xl border border-white/15 px-4 py-3 font-semibold flex items-center justify-center gap-2 hover:bg-white/5 disabled:opacity-60">
              <Chrome className="w-4 h-4" /> Continue with Google
            </button>
            <div className="flex items-center justify-between mt-4 text-xs">
              <button type="button" onClick={handleResetPassword} className="text-gray-400 hover:text-white flex items-center gap-1"><KeyRound className="w-3 h-3" /> Forgot password?</button>
              {role !== 'ADMIN' && <button type="button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')} className="text-gray-400 hover:text-white">{mode === 'signup' ? 'Already have an account?' : 'Create an account'}</button>}
            </div>
          </>
        )}
        <a href="/" className="block text-center text-xs text-gray-500 hover:text-white mt-5">Back to workspace selection</a>
      </form>
    </main>
  );
}