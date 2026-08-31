import React, { useState, useEffect } from 'react';
import { Clock, X, MapPin, Download, Star, CheckCircle, Car } from 'lucide-react';
import { fetchRideHistory } from '../services/api';

export default function HistoryModal({ user, onClose }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchRideHistory(user.id);
      setRides(data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full rounded-3xl p-6 border border-white/15 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
        
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-extrabold text-white">Your Past Trips</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-6 animate-pulse">Loading ride history...</p>
          ) : rides.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">No past rides yet</p>
          ) : (
            rides.map((ride) => (
              <div
                key={ride.id}
                className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-2 hover:border-white/10 transition-all text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white">{ride.category}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-uber-green/20 text-uber-green font-bold">
                      {ride.status}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-white">${ride.fare}</span>
                </div>

                {/* Pickup & Destination */}
                <div className="flex flex-col gap-1 text-gray-300">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-2 h-2 rounded-full bg-uber-accent flex-shrink-0" />
                    <span className="truncate">{ride.pickup?.address}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-2 h-2 rounded-full bg-uber-red flex-shrink-0" />
                    <span className="truncate">{ride.destination?.address}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-gray-500 font-medium">
                  <span>{new Date(ride.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {ride.rating && (
                    <span className="flex items-center gap-1 text-uber-gold font-bold">
                      ★ {ride.rating}.0 Rated
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
