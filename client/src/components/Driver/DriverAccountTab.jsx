import React, { useState } from 'react';
import { 
  TrendingUp, 
  ChevronRight, 
  PlusCircle, 
  CreditCard, 
  Users, 
  FileText, 
  HelpCircle, 
  Settings, 
  AlertTriangle, 
  Sliders, 
  MessageSquare, 
  LogOut, 
  Car, 
  CheckCircle, 
  Award, 
  ShieldCheck, 
  X, 
  UploadCloud, 
  Check, 
  Flame,
  PhoneCall
} from 'lucide-react';

export default function DriverAccountTab({
  driver,
  kycData,
  onUploadKyc,
  currentLanguage = 'kn',
  onOpenSOS,
  onLogout
}) {
  const isKannada = currentLanguage === 'kn';

  const driverName = driver?.name || 'Shekar kulal n';
  const licensePlate = driver?.vehicle?.licensePlate || 'KA-01-EQ-7892';
  const vehicleType = driver?.vehicle?.type || 'Auto';

  // Active modal state
  const [activeModal, setActiveModal] = useState(null); // 'training' | 'vehicle' | 'plans' | 'autopay' | 'refer' | 'deposit' | 'care' | 'settings' | 'duty' | 'report' | 'kyc'
  const [modalSuccessMsg, setModalSuccessMsg] = useState(null);

  // KYC Mock / Server Data
  const kyc = kycData || {
    overallStatus: 'VERIFIED',
    documents: {
      license: { title: 'Driving License', status: 'VERIFIED', docNumber: 'KA-05-20180092' },
      rc: { title: 'Registration Certificate (RC)', status: 'VERIFIED', docNumber: licensePlate },
      insurance: { title: 'Vehicle Insurance', status: 'VERIFIED', docNumber: 'POL-992102' }
    }
  };

  const handleAction = (modalType) => {
    setActiveModal(modalType);
  };

  const handleSimulateAction = (msg) => {
    setModalSuccessMsg(msg);
    setTimeout(() => {
      setModalSuccessMsg(null);
      setActiveModal(null);
    }, 1800);
  };

  return (
    <div className="flex flex-col gap-3.5 pb-28 w-full max-w-md mx-auto text-white animate-in fade-in">
      
      {/* 1. PROFILE HEADER (Screenshot 2) */}
      <div className="flex items-center gap-3.5 pt-1 px-1">
        <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-white overflow-hidden shadow-md flex items-center justify-center shrink-0">
          <img 
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" 
            alt="Shekar kulal n" 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://ui-avatars.com/api/?name=Shekar+Kulal&background=2563eb&color=fff';
            }}
          />
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-wide">
            {driverName}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
            <span className="font-mono">{licensePlate}</span>
            <span>•</span>
            <span className="font-bold text-emerald-400">
              {vehicleType === 'AUTO' || vehicleType === 'Auto' ? 'ಆಟೋ (Auto)' : 'ಟ್ಯಾಕ್ಸಿ (Cab)'}
            </span>
          </p>
        </div>
      </div>

      {/* 2. CANCELLATION RATE CARD (Screenshot 2: "21% Cancellation Rate - Needs Attention") */}
      <div className="glass-card p-4 rounded-3xl border border-white/10 shadow-lg bg-[#14141a]">
        <div className="flex flex-col gap-1">
          <span className="text-3xl font-black text-white">
            21%
          </span>
          <span className="text-xs text-gray-400 font-bold">
            {isKannada ? 'ರದ್ದತಿ ದರ (Cancellation Rate)' : 'Cancellation Rate'}
          </span>
          <span className="text-xs font-black text-orange-400 mt-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isKannada ? 'ಗಮನ ಬೇಕು (Needs Attention)' : 'Needs Attention'}
          </span>
        </div>

        {/* Divider and Performance Link */}
        <div 
          onClick={() => handleAction('performance')}
          className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black text-gray-200 group-hover:text-white">
              {isKannada ? 'ಪ್ರದರ್ಶನ' : 'Performance Insights'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </div>
      </div>

      {/* 3. EXTENDED ACTION MENU (Screenshots 2 & 6) */}
      <div className="glass-card rounded-3xl border border-white/10 overflow-hidden divide-y divide-white/5 bg-[#121218]">

        {/* 1. Get training [NEW] */}
        <button 
          onClick={() => handleAction('training')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              Get training
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              NEW
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </div>
        </button>

        {/* 2. Add New Vehicle */}
        <button 
          onClick={() => handleAction('vehicle')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              Add New Vehicle
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

        {/* 3. Subscription Plans [NEW] */}
        <button 
          onClick={() => handleAction('plans')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              Subscription Plans (0% Fee)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              NEW
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </div>
        </button>

        {/* 4. Manage Autopay [NEW] */}
        <button 
          onClick={() => handleAction('autopay')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              Manage Autopay
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              NEW
            </span>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
          </div>
        </button>

        {/* 5. Refer a Driver */}
        <button 
          onClick={() => handleAction('refer')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              Refer a Driver
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

        {/* 6. ನಗದನ್ನು ಠೇವಣಿ ಮಾಡಿ. (Deposit Cash) */}
        <button 
          onClick={() => handleAction('deposit')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center font-bold text-gray-400 group-hover:text-white">
              ₹
            </div>
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              {isKannada ? 'ನಗದನ್ನು ಠೇವಣಿ ಮಾಡಿ.' : 'Deposit Cash'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

        {/* 7. ಪಾಲುದಾರ ಕೇರ್ (Partner Care) */}
        <button 
          onClick={() => handleAction('care')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              {isKannada ? 'ಪಾಲುದಾರ ಕೇರ್' : 'Partner Care'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

      </div>

      {/* 4. SETTINGS & UTILITIES CARD (Screenshot 6) */}
      <div className="glass-card rounded-3xl border border-white/10 overflow-hidden divide-y divide-white/5 bg-[#121218]">

        {/* 8. ಕಾರು ಬದಲಾಯಿಸಿ (Change Car / Vehicle) */}
        <button 
          onClick={() => handleAction('vehicle')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              {isKannada ? 'ಕಾರು ಬದಲಾಯಿಸಿ' : 'Change Car / Vehicle'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

        {/* 9. ಸೆಟ್ಟಿಂಗ್ಸ್ (Settings) */}
        <button 
          onClick={() => handleAction('settings')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <div>
              <div className="text-xs font-bold text-gray-200 group-hover:text-white">
                {isKannada ? 'ಸೆಟ್ಟಿಂಗ್ಸ್' : 'Settings'}
              </div>
              <div className="text-[10px] text-gray-400">
                {isKannada ? 'ಪ್ರೊಫೈಲ್ ನಿರ್ವಹಿಸಿ, ಆಪ್ ಅಪ್ಡೇಟ್ಸ್' : 'Manage profile, app updates'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

        {/* 10. SOS ತುರ್ತು ಕರೆ (Emergency Alert - in Red) */}
        <button 
          onClick={onOpenSOS}
          className="touch-target w-full flex items-center justify-between p-3.5 bg-red-500/10 hover:bg-red-500/20 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-xs font-black text-red-400">
              {isKannada ? 'SOS ತುರ್ತು ಕರೆ' : 'SOS Emergency Call'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-400" />
        </button>

        {/* 11. ಡ್ಯೂಟಿ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ (Manage Duty Settings) */}
        <button 
          onClick={() => handleAction('duty')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              {isKannada ? 'ಡ್ಯೂಟಿ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ' : 'Manage Duty Settings'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

        {/* 12. ಆ್ಯಪ್ ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡಿ (Report App Issues) */}
        <button 
          onClick={() => handleAction('report')}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              {isKannada ? 'ಆ್ಯಪ್ ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡಿ' : 'Report App Issues'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

        {/* 13. ಲಾಗ್‌ಔಟ್ (Logout) */}
        <button 
          onClick={onLogout}
          className="touch-target w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-5 h-5 text-gray-400 group-hover:text-white" />
            <span className="text-xs font-bold text-gray-200 group-hover:text-white">
              {isKannada ? 'ಲಾಗ್‌ಔಟ್' : 'Logout'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
        </button>

      </div>

      {/* INTERACTIVE ACTION MODAL */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-5 border border-white/20 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 bg-[#121218]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">
                {activeModal === 'training' && (isKannada ? 'ತರಬೇತಿ ಮಾಡ್ಯೂಲ್‌ಗಳು' : 'Driver Training')}
                {activeModal === 'plans' && (isKannada ? 'ಅನಿಯಮಿತ 0% ಪಾಸ್' : '0% Commission Subscription')}
                {activeModal === 'autopay' && (isKannada ? 'ಆಟೋಪೇ ನಿರ್ವಹಿಸಿ' : 'Manage Autopay')}
                {activeModal === 'refer' && (isKannada ? 'ಚಾಲಕರನ್ನು ರೆಫರ್ ಮಾಡಿ' : 'Refer a Driver')}
                {activeModal === 'deposit' && (isKannada ? 'ನಗದು ಠೇವಣಿ' : 'Deposit Cash')}
                {activeModal === 'care' && (isKannada ? 'ಪಾಲುದಾರ ಕೇರ್ & ಸಹಾಯ' : 'Partner Care')}
                {activeModal === 'performance' && (isKannada ? 'ಕಾರ್ಯಕ್ಷಮತೆ ವಿಶ್ಲೇಷಣೆ' : 'Performance Insights')}
                {activeModal === 'vehicle' && (isKannada ? 'ವಾಹನ ನಿರ್ವಹಣೆ' : 'Vehicle Management')}
                {activeModal === 'settings' && (isKannada ? 'ಆ್ಯಪ್ ಸೆಟ್ಟಿಂಗ್ಸ್' : 'App Settings')}
                {activeModal === 'duty' && (isKannada ? 'ಡ್ಯೂಟಿ ನಿಯಮಗಳು' : 'Duty Settings')}
                {activeModal === 'report' && (isKannada ? 'ಸಮಸ್ಯೆ ವರದಿ' : 'Report an Issue')}
              </h3>
              <button onClick={() => setActiveModal(null)} className="touch-target p-1 text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 text-center font-bold text-xs flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />
                <span>{modalSuccessMsg}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-xs text-gray-300">
                {activeModal === 'training' && (
                  <>
                    <p>Complete certified driver safety modules to reduce cancellation rates and unlock top priority bookings.</p>
                    <button 
                      onClick={() => handleSimulateAction('Training Module Completed!')}
                      className="touch-target w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black"
                    >
                      Start 2-Min Quick Safety Test
                    </button>
                  </>
                )}

                {activeModal === 'plans' && (
                  <>
                    <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
                      <div className="font-black text-emerald-300 text-sm">₹0 Commission Pass Active</div>
                      <div className="text-[11px] text-gray-300 mt-1">24 Hours Unlimited Rides • Keep 100% of all customer fares.</div>
                    </div>
                    <button 
                      onClick={() => handleSimulateAction('Pass auto-renewed for 24 hours!')}
                      className="touch-target w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black"
                    >
                      Renew Daily Pass (₹29/day)
                    </button>
                  </>
                )}

                {activeModal === 'autopay' && (
                  <>
                    <p>Setup UPI Mandate or auto-debit for seamless daily subscription pass renewals.</p>
                    <input 
                      type="text" 
                      placeholder="Enter UPI ID (e.g. yourname@okhdfcbank)" 
                      className="bg-[#181822] border border-white/20 rounded-xl px-3 py-2 text-white font-mono"
                    />
                    <button 
                      onClick={() => handleSimulateAction('Autopay mandate verified!')}
                      className="touch-target w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black"
                    >
                      Link UPI Autopay
                    </button>
                  </>
                )}

                {activeModal === 'refer' && (
                  <>
                    <p>Invite your fellow drivers to join NexRide. Earn ₹250 once they finish 10 rides, up to ₹2000 bonus.</p>
                    <div className="p-3 bg-black/40 rounded-xl font-mono text-center font-bold text-amber-300 text-sm">
                      NEX-SHEKAR77
                    </div>
                    <button 
                      onClick={() => handleSimulateAction('Referral code copied!')}
                      className="touch-target w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black"
                    >
                      Share on WhatsApp
                    </button>
                  </>
                )}

                {activeModal === 'care' && (
                  <>
                    <p>Need immediate help on an ongoing trip or billing issue? Connect with dedicated partner care.</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSimulateAction('Connecting to support line...')}
                        className="touch-target flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black flex items-center justify-center gap-1.5"
                      >
                        <PhoneCall className="w-4 h-4" /> Call 24x7 Care
                      </button>
                    </div>
                  </>
                )}

                {activeModal === 'performance' && (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between border-b border-white/10 pb-1">
                        <span>Total Completed Trips</span>
                        <span className="font-bold text-white">428</span>
                      </div>
                      <div className="flex justify-between border-b border-white/10 pb-1">
                        <span>Customer Rating</span>
                        <span className="font-bold text-emerald-400">★ 4.85</span>
                      </div>
                      <div className="flex justify-between border-b border-white/10 pb-1">
                        <span>Cancellation Rate</span>
                        <span className="font-bold text-orange-400">21% (Needs Attention)</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="touch-target w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold mt-2"
                    >
                      Understood
                    </button>
                  </>
                )}

                {activeModal === 'deposit' && (
                  <>
                    <p>Deposit collected cash payments back into company pool via UPI or nodal bank counter.</p>
                    <button 
                      onClick={() => handleSimulateAction('₹250 Cash Deposited!')}
                      className="touch-target w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black"
                    >
                      Deposit ₹250 Collected Cash
                    </button>
                  </>
                )}

                {['vehicle', 'settings', 'duty', 'report'].includes(activeModal) && (
                  <>
                    <p>Option configuration loaded. Modify duty or report issue directly to fleet manager.</p>
                    <button 
                      onClick={() => handleSimulateAction('Settings Updated Successfully!')}
                      className="touch-target w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black"
                    >
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
