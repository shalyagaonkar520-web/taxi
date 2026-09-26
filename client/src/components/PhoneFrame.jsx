import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Car, 
  Navigation, 
  ShieldCheck, 
  Smartphone, 
  Maximize2, 
  Minimize2, 
  Wifi, 
  Battery, 
  Signal, 
  Layers,
  Sparkles
} from 'lucide-react';

export default function PhoneFrame({
  children,
  role = 'RIDER', // 'RIDER' | 'DRIVER' | 'ADMIN'
  activeRide = null,
  driversCount = 0
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isFullWidth, setIsFullWidth] = useState(false);

  // If viewing Admin role, Admin is desktop-first by default!
  const isAdmin = role === 'ADMIN';

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // On true mobile (< 768px), always render 100dvh full width
  return (
    <div className="min-h-[100dvh] w-full bg-[#09090b] flex flex-col md:flex-row items-center justify-center overflow-x-hidden">
      
      {/* Desktop Side Companion Panel (Visible on md+ screens) */}
      <aside className="hidden md:flex flex-col justify-between w-80 lg:w-96 h-[92dvh] my-auto mr-8 p-6 bg-[#121216]/90 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl z-20">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-uber-accent to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                NexRide
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  LIVE
                </span>
              </h1>
              <p className="text-xs text-gray-400">Urban Mobility & Dispatch Hub</p>
            </div>
          </div>

          {/* Quick Workspace Switcher */}
          <p className="text-[11px] font-semibold tracking-wider uppercase text-gray-400 mb-3">
            Select Workspace
          </p>
          <div className="space-y-2 mb-6">
            <button
              onClick={() => navigate('/rider')}
              className={`w-full touch-target px-4 py-3 rounded-2xl flex items-center justify-between transition-all ${
                location.pathname === '/rider'
                  ? 'bg-uber-accent text-white font-semibold shadow-lg shadow-blue-600/30'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <Car className="w-4 h-4" />
                <span className="text-sm">Rider Workspace</span>
              </div>
              <span className="text-xs opacity-75">Mobile-First</span>
            </button>

            <button
              onClick={() => navigate('/driver')}
              className={`w-full touch-target px-4 py-3 rounded-2xl flex items-center justify-between transition-all ${
                location.pathname === '/driver'
                  ? 'bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-600/30'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <Navigation className="w-4 h-4" />
                <span className="text-sm">Driver HUD</span>
              </div>
              <span className="text-xs opacity-75">Turn-by-Turn</span>
            </button>

            <button
              onClick={() => navigate('/admin')}
              className={`w-full touch-target px-4 py-3 rounded-2xl flex items-center justify-between transition-all ${
                location.pathname === '/admin'
                  ? 'bg-purple-600 text-white font-semibold shadow-lg shadow-purple-600/30'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-sm">Admin God-View</span>
              </div>
              <span className="text-xs opacity-75">Fleet Map</span>
            </button>
          </div>

          {/* Quick Info & State */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Active Online Fleet:</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {driversCount || 4} Drivers
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Dispatch Mode:</span>
              <span className="font-semibold text-blue-400">OSRM ETA Engine</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Current Trip State:</span>
              <span className="font-semibold text-amber-400">
                {activeRide ? activeRide.status : 'Idle / Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* View mode toggle & Home Link */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          {!isAdmin && (
            <button
              onClick={() => setIsFullWidth(!isFullWidth)}
              className="w-full touch-target px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center justify-center gap-2 transition-colors"
            >
              {isFullWidth ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullWidth ? 'Snap to Phone Frame (390px)' : 'Expand to Full Viewport'}</span>
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="w-full touch-target px-3 py-2.5 rounded-xl text-gray-400 hover:text-white text-xs flex items-center justify-center gap-2"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Return to Workspace Launcher</span>
          </button>
        </div>
      </aside>

      {/* Main App Container: Full width on mobile, sleek phone frame on desktop */}
      <main
        className={`relative w-full h-[100dvh] flex flex-col overflow-hidden transition-all duration-300 ${
          isAdmin || isFullWidth
            ? 'md:h-[100dvh] md:max-w-none md:rounded-none md:border-none'
            : 'md:h-[844px] md:max-h-[94dvh] md:max-w-[412px] md:rounded-[44px] md:border-[6px] md:border-[#27272a] md:shadow-[0_25px_70px_rgba(0,0,0,0.85)]'
        }`}
      >
        {/* Dynamic Island / Status Bar for Phone Mockup on Desktop */}
        {!isAdmin && !isFullWidth && (
          <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-2 z-50 bg-[#09090b]/80 backdrop-blur-md text-white select-none pointer-events-none">
            <span className="text-xs font-semibold tracking-tight">{currentTime}</span>
            {/* Dynamic camera notch pill */}
            <div className="w-24 h-4 bg-black rounded-full border border-white/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#18181b] mr-2" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/80" />
            </div>
            <div className="flex items-center gap-1.5 text-white/80">
              <Signal className="w-3.5 h-3.5" />
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* Inner Content Area */}
        <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col">
          {children}
        </div>
      </main>

    </div>
  );
}
