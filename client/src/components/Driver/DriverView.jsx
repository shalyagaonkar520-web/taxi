import React, { useState, useEffect } from 'react';
import { 
  Home, 
  DollarSign, 
  Award, 
  User, 
  Navigation,
  AlertCircle,
  Menu,
  Shield,
  Bell,
  Compass,
  Sliders,
  MessageSquare,
  Globe,
  Radio,
  CheckCircle,
  X
} from 'lucide-react';
import { socket } from '../../services/socket';
import { sound } from '../../utils/audio';

// Subcomponents
import DriverHomeTab from './DriverHomeTab';
import DriverServicesTab from './DriverServicesTab';
import DriverEarningsTab from './DriverEarningsTab';
import DriverRewardsTab from './DriverRewardsTab';
import DriverInboxTab from './DriverInboxTab';
import DriverAccountTab from './DriverAccountTab';
import DriverSideDrawer from './DriverSideDrawer';
import DriverErrorModal from './DriverErrorModal';
import DriverRideRequestSheet from './DriverRideRequestSheet';
import DriverActiveTripHUD from './DriverActiveTripHUD';
import DriverStatementModal from './DriverStatementModal';
import DriverKeypadCallSimulator from './DriverKeypadCallSimulator';

export default function DriverView({
  driver,
  activeRide,
  onRideUpdate,
  onStatusChange,
  showHeatmap = false,
  onToggleHeatmap,
  heatmapZones = []
}) {
  // Navigation State
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'services' | 'earnings' | 'rewards' | 'inbox' | 'account'
  const [currentLanguage, setCurrentLanguage] = useState('kn'); // 'kn' (Kannada) | 'en' (English)
  const isKannada = currentLanguage === 'kn';

  // Driver Operational States
  const [isOnline, setIsOnline] = useState(driver?.status === 'ONLINE');
  const [sessionSeconds, setSessionSeconds] = useState(19440); // ~5.4h session
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [autoAccept, setAutoAccept] = useState(false);
  const [destinationMode, setDestinationMode] = useState({ enabled: false, destination: null });
  
  // Data Containers
  const [summaryData, setSummaryData] = useState(null);
  const [earningsData, setEarningsData] = useState(null);
  const [earningsRange, setEarningsRange] = useState('week');
  const [questsData, setQuestsData] = useState(null);
  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modals & Overlays
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState(null);
  const [sosBanner, setSosBanner] = useState(null);

  const driverId = driver?.id || 'driver-01';

  // Live session timer effect
  useEffect(() => {
    let timer = null;
    if (isOnline) {
      timer = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOnline]);

  // Load Driver Backend Data
  const loadDriverData = async () => {
    setLoading(true);
    try {
      const [summaryRes, earningsRes, questsRes, kycRes, destRes] = await Promise.all([
        fetch(`/api/driver/${driverId}/summary`).then(r => r.ok ? r.json() : null),
        fetch(`/api/driver/${driverId}/earnings?range=${earningsRange}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/driver/${driverId}/quests`).then(r => r.ok ? r.json() : null),
        fetch(`/api/driver/${driverId}/kyc`).then(r => r.ok ? r.json() : null),
        fetch(`/api/driver/${driverId}/destination`).then(r => r.ok ? r.json() : null)
      ]);

      if (summaryRes) setSummaryData(summaryRes);
      if (earningsRes) setEarningsData(earningsRes);
      if (questsRes) setQuestsData(questsRes);
      if (kycRes) setKycData(kycRes);
      if (destRes) setDestinationMode(destRes);
    } catch (err) {
      console.warn('Failed to fetch driver backend data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, [driverId, earningsRange]);

  // Socket Events
  useEffect(() => {
    const handleIncomingRequest = (data) => {
      setIncomingRequest(data);
    };

    const handleAcceptedConfirmation = (data) => {
      onRideUpdate(data.ride);
      setIncomingRequest(null);
    };

    const handleArrivalConfirmed = (data) => {
      onRideUpdate(data.ride);
    };

    const handleStartedConfirmation = (data) => {
      onRideUpdate(data.ride);
    };

    const handleCompletedConfirmation = (data) => {
      onRideUpdate(null);
      loadDriverData();
      try { sound.playTripCompleted(); } catch (e) {}
    };

    const handleRequestClosed = () => {
      setIncomingRequest(null);
    };

    const handleCancelledByRider = (data) => {
      alert(data.message || (isKannada ? 'ಪ್ರಯಾಣಿಕರು ಈ ಸವಾರಿಯನ್ನು ರದ್ದುಗೊಳಿಸಿದ್ದಾರೆ.' : 'The rider has cancelled this trip.'));
      onRideUpdate(null);
      loadDriverData();
    };

    socket.on('ride:incoming_request', handleIncomingRequest);
    socket.on('ride:accepted_confirmation', handleAcceptedConfirmation);
    socket.on('ride:arrival_confirmed', handleArrivalConfirmed);
    socket.on('ride:started_confirmation', handleStartedConfirmation);
    socket.on('ride:completed_confirmation', handleCompletedConfirmation);
    socket.on('ride:request_closed', handleRequestClosed);
    socket.on('ride:request_cancelled', handleRequestClosed);
    socket.on('ride:cancelled_by_rider', handleCancelledByRider);

    return () => {
      socket.off('ride:incoming_request', handleIncomingRequest);
      socket.off('ride:accepted_confirmation', handleAcceptedConfirmation);
      socket.off('ride:arrival_confirmed', handleArrivalConfirmed);
      socket.off('ride:started_confirmation', handleStartedConfirmation);
      socket.off('ride:completed_confirmation', handleCompletedConfirmation);
      socket.off('ride:request_closed', handleRequestClosed);
      socket.off('ride:request_cancelled', handleRequestClosed);
      socket.off('ride:cancelled_by_rider', handleCancelledByRider);
    };
  }, [driverId, onRideUpdate, isKannada]);

  // Online / Offline Status Toggle
  const handleToggleOnline = () => {
    const newStatus = isOnline ? 'OFFLINE' : 'ONLINE';
    setIsOnline(!isOnline);
    onStatusChange(newStatus);
    
    socket.emit('driver:status', {
      driverId,
      status: newStatus,
      destinationMode
    });

    try { sound.playBell(); } catch (e) {}
  };

  // Ride Request Actions
  const handleAcceptRide = (req) => {
    socket.emit('ride:accept', {
      rideId: req.ride.id,
      driverId
    });
    // Optimistic fallback for immediate UX feedback
    if (!activeRide) {
      onRideUpdate({
        ...req.ride,
        driverId,
        status: 'ACCEPTED'
      });
    }
  };

  const handleDeclineRide = (req, reason = 'DRIVER_DECLINED') => {
    socket.emit('ride:decline', {
      rideId: req.ride.id,
      driverId,
      reason
    });
    setIncomingRequest(null);
  };

  // Destination Mode Update
  const handleUpdateDestination = async (destState) => {
    setDestinationMode(destState);
    try {
      await fetch(`/api/driver/${driverId}/destination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(destState)
      });
      socket.emit('driver:status', {
        driverId,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        destinationMode: destState
      });
    } catch (e) {
      setErrorModalContent({
        title: isKannada ? 'ಆದ್ಯತೆ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಿಲ್ಲ' : 'Could not save preference',
        message: isKannada ? 'ದಯವಿಟ್ಟು ನೆಟ್‌ವರ್ಕ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.' : 'Please check network connection and try again.'
      });
      setShowErrorModal(true);
    }
  };

  // Cashout action
  const handleCashout = async (amount, method) => {
    try {
      const res = await fetch(`/api/driver/${driverId}/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method })
      });
      if (res.ok) {
        loadDriverData();
      }
    } catch (e) {}
  };

  // Claim Quest / Scratch Card Bonus
  const handleClaimBonus = async (amount) => {
    try {
      await fetch(`/api/driver/${driverId}/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: -amount, method: 'REWARD_BONUS' })
      });
      loadDriverData();
    } catch (e) {}
  };

  // Upload KYC
  const handleUploadKyc = async (docType, fileData) => {
    try {
      const res = await fetch(`/api/driver/${driverId}/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, data: fileData })
      });
      if (res.ok) {
        const updated = await res.json();
        setKycData(updated);
      }
    } catch (e) {}
  };

  // SOS Emergency Trigger
  const handleTriggerSOS = () => {
    socket.emit('admin:sos_alert', {
      rideId: activeRide?.id || 'NO_RIDE',
      riderId: activeRide?.riderId || 'N/A',
      driverId,
      driverName: driver?.name || 'Shekar kulal n',
      location: { lat: 12.9716, lng: 77.5946 },
      timestamp: new Date().toISOString()
    });

    setSosBanner(isKannada ? 'ತುರ್ತು SOS ಎಚ್ಚರಿಕೆಯನ್ನು ಕಂಟ್ರೋಲ್ ರೂಮ್‌ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ!' : 'Emergency SOS alert dispatched to Central Control Room!');
    setTimeout(() => setSosBanner(null), 6000);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden pointer-events-auto bg-[#09090e]">
      
      {/* 1. TOP APP BAR (Bilingual, Hamburger Drawer & Safety Buttons) */}
      <header className="w-full bg-[#0d0d12]/95 backdrop-blur-xl border-b border-white/10 px-3 py-2.5 flex items-center justify-between z-30 shadow-md">
        
        {/* Left: Hamburger drawer trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="touch-target p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* App title / driver name pill */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
            <span className="text-sm font-black text-white tracking-wide">
              {isKannada ? 'ನಮ್ಮ ಡ್ರೈವರ್' : 'NexRide Partner'}
            </span>
          </div>
        </div>

        {/* Right: Language switch + Notification bell + SOS Shield */}
        <div className="flex items-center gap-1.5">
          
          {/* Language Switcher Pill */}
          <button
            onClick={() => setCurrentLanguage(isKannada ? 'en' : 'kn')}
            className="touch-target px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black text-gray-200 border border-white/10 transition-all flex items-center gap-1"
            title="Toggle Language"
          >
            <span className="text-blue-400 font-bold">文A</span>
            <span>{isKannada ? 'ಕನ್ನಡ' : 'EN'}</span>
          </button>

          {/* Inbox Bell with unread badge 6 */}
          <button
            onClick={() => setActiveTab('inbox')}
            className="touch-target relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-all"
            title="Inbox"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
              6
            </span>
          </button>

          {/* SOS Shield */}
          <button
            onClick={handleTriggerSOS}
            className="touch-target p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all"
            title="Emergency SOS"
          >
            <Shield className="w-4 h-4" />
          </button>

        </div>
      </header>

      {/* SOS CONFIRMATION BANNER */}
      {sosBanner && (
        <div className="absolute top-14 left-3 right-3 z-50 p-3 rounded-2xl bg-red-600/95 text-white text-xs font-bold shadow-2xl flex items-center justify-between animate-in slide-in-from-top-2">
          <span>{sosBanner}</span>
          <button onClick={() => setSosBanner(null)} className="touch-target p-1">✕</button>
        </div>
      )}

      {/* 2. MAIN SCROLLABLE CONTENT CONTAINER */}
      <main className="flex-1 w-full overflow-y-auto px-3 pt-3 pb-24 max-w-md mx-auto">
        
        {/* If active trip ongoing -> Active Trip HUD */}
        {activeRide ? (
          <DriverActiveTripHUD
            activeRide={activeRide}
            driver={driver}
            onRideUpdate={onRideUpdate}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <DriverHomeTab
                driver={driver}
                isOnline={isOnline}
                onToggleOnline={handleToggleOnline}
                sessionSeconds={sessionSeconds}
                summaryData={summaryData}
                showHeatmap={showHeatmap}
                onToggleHeatmap={onToggleHeatmap}
                heatmapZones={heatmapZones}
                destinationMode={destinationMode}
                onUpdateDestination={handleUpdateDestination}
                autoAccept={autoAccept}
                onToggleAutoAccept={() => setAutoAccept(!autoAccept)}
                currentLanguage={currentLanguage}
                onOpenSOS={handleTriggerSOS}
                onOpenPreferences={() => setActiveTab('services')}
                incomingRequest={incomingRequest}
                onAcceptRide={handleAcceptRide}
                onDeclineRide={handleDeclineRide}
              />
            )}

            {activeTab === 'services' && (
              <DriverServicesTab
                driver={driver}
                onBack={() => setActiveTab('home')}
                currentLanguage={currentLanguage}
                destinationMode={destinationMode}
                onUpdateDestination={handleUpdateDestination}
              />
            )}

            {activeTab === 'earnings' && (
              <DriverEarningsTab
                driver={driver}
                earningsData={earningsData}
                range={earningsRange}
                onChangeRange={setEarningsRange}
                onCashout={handleCashout}
                onOpenStatement={() => setShowStatementModal(true)}
                loading={loading}
                currentLanguage={currentLanguage}
              />
            )}

            {activeTab === 'rewards' && (
              <DriverRewardsTab
                driver={driver}
                currentLanguage={currentLanguage}
                onClaimBonus={handleClaimBonus}
              />
            )}

            {activeTab === 'inbox' && (
              <DriverInboxTab
                driver={driver}
                currentLanguage={currentLanguage}
              />
            )}

            {activeTab === 'account' && (
              <DriverAccountTab
                driver={driver}
                kycData={kycData}
                onUploadKyc={handleUploadKyc}
                currentLanguage={currentLanguage}
                onOpenSOS={handleTriggerSOS}
                onLogout={() => {
                  if (isOnline) handleToggleOnline();
                  alert(isKannada ? 'ಯಶಸ್ವಿಯಾಗಿ ಲಾಗ್‌ಔಟ್ ಆಗಿದೆ.' : 'Logged out successfully.');
                }}
              />
            )}
          </>
        )}

      </main>

      {/* 3. SLIDE-OUT LEFT DRAWER (Screenshot 1 & 9) */}
      <DriverSideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        driver={driver}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsDrawerOpen(false);
        }}
        currentLanguage={currentLanguage}
        onLanguageChange={(lang) => setCurrentLanguage(lang)}
        onOpenSOS={handleTriggerSOS}
      />

      {/* 4. ERROR MODAL (Screenshot 8) */}
      <DriverErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorModalContent?.title}
        message={errorModalContent?.message}
        currentLanguage={currentLanguage}
      />

      {/* 5. STATEMENT MODAL */}
      {showStatementModal && (
        <DriverStatementModal
          driver={driver}
          earningsData={earningsData}
          onClose={() => setShowStatementModal(false)}
        />
      )}

      {/* 6. INCOMING RIDE REQUEST SHEET POPUP */}
      {incomingRequest && (
        <DriverRideRequestSheet
          request={incomingRequest}
          onAccept={handleAcceptRide}
          onDecline={handleDeclineRide}
          autoAccept={autoAccept}
        />
      )}

      {/* 6.5 KEYPAD / FEATURE PHONE IVR CALL SIMULATOR (Local & Free Demo) */}
      <DriverKeypadCallSimulator
        driver={driver}
        onRideAccepted={(rideData) => {
          if (onRideUpdate) onRideUpdate(rideData);
        }}
      />

      {/* 7. DOCKED 5-TAB BOTTOM NAVIGATION BAR (Screenshots 2, 3, 6, 8, 10) */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#09090d]/95 backdrop-blur-xl border-t border-white/10 px-1 py-1 sm:py-2 shadow-2xl"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5">
          
          {/* Tab 1: Home (ಹೋಮ್) */}
          <button
            onClick={() => setActiveTab('home')}
            className={`touch-target flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              activeTab === 'home'
                ? 'bg-blue-600/20 text-blue-400 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Navigation className={`w-5 h-5 ${activeTab === 'home' ? 'text-blue-400 rotate-45' : ''}`} />
            <span className="text-[10px] font-bold">
              {isKannada ? 'ಹೋಮ್' : 'Home'}
            </span>
          </button>

          {/* Tab 2: Explore / Services (ಅನ್ವೇಷಿಸಿ) */}
          <button
            onClick={() => setActiveTab('services')}
            className={`touch-target flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              activeTab === 'services'
                ? 'bg-purple-500/20 text-purple-400 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass className={`w-5 h-5 ${activeTab === 'services' ? 'text-purple-400' : ''}`} />
            <span className="text-[10px] font-bold">
              {isKannada ? 'ಅನ್ವೇಷಿಸಿ' : 'Explore'}
            </span>
          </button>

          {/* Tab 3: Earnings (ಗಳಿಕೆಗಳು) */}
          <button
            onClick={() => setActiveTab('earnings')}
            className={`touch-target flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              activeTab === 'earnings'
                ? 'bg-emerald-500/20 text-emerald-400 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className={`w-5 h-5 flex items-center justify-center font-bold text-base ${activeTab === 'earnings' ? 'text-emerald-400' : ''}`}>
              ₹
            </div>
            <span className="text-[10px] font-bold">
              {isKannada ? 'ಗಳಿಕೆಗಳು' : 'Earnings'}
            </span>
          </button>

          {/* Tab 4: Inbox (ಇನ್‌ಬಾಕ್ಸ್ with badge 6) */}
          <button
            onClick={() => setActiveTab('inbox')}
            className={`touch-target relative flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              activeTab === 'inbox'
                ? 'bg-amber-500/20 text-amber-300 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <MessageSquare className={`w-5 h-5 ${activeTab === 'inbox' ? 'text-amber-300' : ''}`} />
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-black text-white border border-white/40 text-[8px] font-black">
                6
              </span>
            </div>
            <span className="text-[10px] font-bold">
              {isKannada ? 'ಇನ್‌ಬಾಕ್ಸ್' : 'Inbox'}
            </span>
          </button>

          {/* Tab 5: Menu / Account (ಮೆನು with badge 3) */}
          <button
            onClick={() => setActiveTab('account')}
            className={`touch-target relative flex flex-col items-center justify-center gap-1 py-1 rounded-2xl transition-all ${
              activeTab === 'account'
                ? 'bg-teal-500/20 text-teal-300 font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <User className={`w-5 h-5 ${activeTab === 'account' ? 'text-teal-300' : ''}`} />
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-black text-emerald-400 border border-emerald-400/40 text-[8px] font-black">
                3
              </span>
            </div>
            <span className="text-[10px] font-bold">
              {isKannada ? 'ಮೆನು' : 'Menu'}
            </span>
          </button>

        </div>
      </nav>

    </div>
  );
}
