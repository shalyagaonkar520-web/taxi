import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[85vh] bg-white dark:bg-[#16161b] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Your past trips</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Loading…</p>
          ) : rides.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              You have not taken a ride yet.
            </p>
          ) : (
            rides.map((ride) => (
              <div
                key={ride.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {ride.category}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold text-slate-900 dark:text-white">
                    ${ride.fare}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-uber-green" />
                    <span className="min-w-0 text-xs text-slate-600 dark:text-slate-300 truncate">
                      {ride.pickup?.address}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-uber-red" />
                    <span className="min-w-0 text-xs text-slate-600 dark:text-slate-300 truncate">
                      {ride.destination?.address}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                  <span className="min-w-0 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {new Date(ride.createdAt).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                  {ride.rating && (
                    <span className="shrink-0 text-[11px] font-bold text-uber-gold">
                      ★ {ride.rating}
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
