import React, { useState } from 'react';
import { 
  Car, 
  Wallet, 
  Star, 
  Plus, 
  User, 
  ChevronDown, 
  Clock, 
  Activity,
  Zap,
  MapPin
} from 'lucide-react';

export default function Navbar({ 
  currentRole, 
  user, 
  walletBalance, 
  onOpenWallet,
  onOpenHistory,
  onOpenProfile,
  isConnected 
}) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-uber-accent to-blue-400 flex items-center justify-center shadow-lg shadow-uber-accent/25 ring-1 ring-white/20">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                NexRide
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-uber-accent/20 text-uber-accent border border-uber-accent/30">
                Live
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-medium hidden sm:block">Next-Gen Ride Hailing Platform</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-300">
          {currentRole === 'RIDER' ? 'User workspace' : currentRole === 'DRIVER' ? 'Driver workspace' : 'Admin workspace'}
        </div>

        {/* Right Section: Connection, Wallet & Profile */}
        <div className="flex items-center gap-3">
          
          {/* Live Status Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/5 text-[11px] text-gray-300">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-uber-green animate-pulse' : 'bg-uber-red'}`} />
            <span>{isConnected ? 'Real-Time Sync' : 'Reconnecting...'}</span>
          </div>

          {/* Wallet Balance Pill */}
          {currentRole === 'RIDER' && (
            <button
              onClick={onOpenWallet}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all group"
            >
              <div className="w-5 h-5 rounded-lg bg-uber-accent/20 flex items-center justify-center text-uber-accent group-hover:scale-110 transition-transform">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <span>${Number(walletBalance || 0).toFixed(2)}</span>
              <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
            </button>
          )}

          {/* User history and profile */}
          {currentRole === 'RIDER' && (
            <>
              <button onClick={onOpenHistory} title="Your trips" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition-all">
                <Clock className="w-4 h-4" /><span className="hidden sm:inline">Trips</span>
              </button>
              <button onClick={onOpenProfile} title="Edit profile" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all">
                <User className="w-4 h-4" />
              </button>
            </>
          )}

          {/* User Avatar */}
          {user && (
            <div className="relative">
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt={user.name}
                  className="w-8 h-8 rounded-xl object-cover ring-2 ring-white/10"
                />
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold leading-none">{user.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 fill-uber-gold text-uber-gold" />
                    <span className="text-[11px] text-gray-400 font-medium">{user.rating || 4.9}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </header>
  );
}
