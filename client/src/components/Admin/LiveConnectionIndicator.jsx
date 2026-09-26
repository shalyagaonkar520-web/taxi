import React from 'react';
import { Radio } from 'lucide-react';

export default function LiveConnectionIndicator({ isConnected = true }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md transition-all ${
        isConnected
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {isConnected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
        )}
      </span>
      <span>{isConnected ? 'LIVE TELEMETRY' : 'CONNECTION LOST'}</span>
      {!isConnected && (
        <span className="text-[10px] text-rose-300/80 font-normal hidden sm:inline">
          Reconnecting...
        </span>
      )}
    </div>
  );
}
