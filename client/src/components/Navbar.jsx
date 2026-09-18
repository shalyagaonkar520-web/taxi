import React from 'react';
import { Car, Wallet, Star, Plus, Sun, Moon } from 'lucide-react';

export default function Navbar({
  currentRole,
  user,
  walletBalance,
  onOpenWallet,
  isConnected,
  theme,
  onToggleTheme
}) {
  const isRider = currentRole === 'RIDER';

  return (
    <header className="shrink-0 z-50 w-full glass-panel border-b px-3 sm:px-5 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 h-9 w-9 rounded-xl bg-uber-accent flex items-center justify-center shadow-md shadow-uber-accent/25">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
              NexRide
            </p>
            <p className="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400 hidden sm:block">
              {isRider ? 'Book a ride' : currentRole === 'DRIVER' ? 'Driver workspace' : 'Admin workspace'}
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connection dot - icon only on small screens so nothing wraps */}
          <span
            title={isConnected ? 'Connected' : 'Reconnecting…'}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
          >
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-uber-green animate-pulse' : 'bg-uber-red'}`}
            />
            {isConnected ? 'Live' : 'Reconnecting…'}
          </span>

          {isRider && (
            <button
              onClick={onOpenWallet}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-xs font-extrabold text-slate-800 dark:text-white transition-colors"
            >
              <Wallet className="w-4 h-4 text-uber-accent" />
              <span>${Number(walletBalance || 0).toFixed(2)}</span>
              <Plus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          )}

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {user && (
            <img
              src={
                user.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
              }
              alt={user.name}
              title={`${user.name} · ${user.rating || 4.9} ★`}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-white/10 bg-slate-200"
            />
          )}

          {user && (
            <div className="hidden lg:block text-left min-w-0">
              <p className="text-xs font-bold leading-none text-slate-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 fill-uber-gold text-uber-gold" />
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {user.rating || 4.9}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
