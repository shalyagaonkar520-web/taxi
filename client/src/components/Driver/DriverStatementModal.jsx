import React from 'react';
import { X, Printer, Download, CheckCircle, FileText, Calendar } from 'lucide-react';

export default function DriverStatementModal({
  driver,
  earningsData,
  onClose
}) {
  const summary = earningsData?.summary || {};
  const trips = earningsData?.trips || [];
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#18181b] border border-white/20 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 max-h-[90dvh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black">Official Weekly Earnings Statement</h2>
              <p className="text-xs text-gray-400">NexRide Partner Settlement Report</p>
            </div>
          </div>

          <button onClick={onClose} className="touch-target p-1.5 text-gray-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Partner & Statement Metadata */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-black/40 border border-white/5 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400">Driver Partner</span>
            <p className="font-black text-white mt-0.5">{driver?.name || 'Michael Rodriguez'}</p>
            <p className="text-gray-400 text-[11px]">{driver?.email || 'michael.driver@example.com'}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-gray-400">Statement Period</span>
            <p className="font-black text-white mt-0.5">Current Week (Mon - Sun)</p>
            <p className="text-gray-400 text-[11px]">Generated: {currentDate}</p>
          </div>
        </div>

        {/* Financial Summary Breakdown */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Gross Trip Fares:</span>
            <span className="font-bold text-white">${summary.totalGross || 298.50}</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Surge & Peak Bonuses:</span>
            <span className="font-bold">+$48.20</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Rider Tips (100% Driver Keep):</span>
            <span className="font-bold">+$28.00</span>
          </div>
          <div className="flex justify-between text-red-400">
            <span>Platform Commission (20%):</span>
            <span className="font-bold">-${((summary.totalGross || 298) * 0.20).toFixed(2)}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-black">
            <span className="text-white">Net Settled Earnings:</span>
            <span className="text-emerald-400 font-mono">${summary.totalNet || 315.40}</span>
          </div>
        </div>

        {/* Itemized Trips Table */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
            Trip Transaction Ledger ({trips.length} Trips)
          </h3>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-white/5 text-gray-400 text-[10px] uppercase font-bold border-b border-white/10">
                <tr>
                  <th className="px-3 py-2">Trip ID</th>
                  <th className="px-3 py-2">Pickup / Drop</th>
                  <th className="px-3 py-2">Gross</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-blue-400">{trip.id}</td>
                    <td className="px-3 py-2 text-[11px] truncate max-w-[130px]">
                      {trip.pickup?.split(',')[0]} → {trip.destination?.split(',')[0]}
                    </td>
                    <td className="px-3 py-2 font-bold">${trip.fare?.toFixed(2)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-400">${trip.net?.toFixed(2)}</td>
                    <td className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400">
                      {trip.paymentMethod}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="touch-target py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Statement</span>
          </button>
          <button
            onClick={handlePrint}
            className="touch-target py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>

      </div>
    </div>
  );
}
