import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  MapPin, 
  Compass, 
  Clock, 
  KeyRound, 
  CheckCircle, 
  ArrowRight, 
  MessageSquare, 
  Phone, 
  Shield, 
  X, 
  AlertTriangle, 
  Send,
  DollarSign,
  User,
  Gauge
} from 'lucide-react';
import { socket } from '../../services/socket';
import { sound } from '../../utils/audio';

export default function DriverActiveTripHUD({
  activeRide,
  driver,
  onRideUpdate
}) {
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [showCallModal, setShowCallModal] = useState(false);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [sosSent, setSosSent] = useState(false);

  // Arrival Waiting Timer
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const isArrived = activeRide?.status === 'ARRIVED';
  const isInProgress = activeRide?.status === 'IN_PROGRESS';

  // 3-Minute Free Grace Period (180 seconds), then $0.25 per minute ($0.00416/sec)
  const GRACE_PERIOD_SEC = 180;
  const isGraceExpired = waitingSeconds > GRACE_PERIOD_SEC;
  const waitingFee = isGraceExpired 
    ? Number(((waitingSeconds - GRACE_PERIOD_SEC) * (0.25 / 60)).toFixed(2))
    : 0.00;

  // Turn-by-turn simulation state
  const [maneuver, setManeuver] = useState({
    instruction: isArrived 
      ? 'Arrived at pickup location'
      : isInProgress 
        ? 'Head straight on Outer Ring Rd towards dropoff' 
        : 'Continue along Main Blvd towards passenger',
    nextStep: isInProgress ? 'Take flyover in 600m' : 'Turn right onto 4th Cross in 250m',
    distance: isInProgress ? `${(activeRide.distanceKm || 5.2).toFixed(1)} km` : '350m',
    speed: isInProgress ? '46 km/h' : '38 km/h'
  });

  // Waiting timer effect
  useEffect(() => {
    let timer = null;
    if (isArrived) {
      timer = setInterval(() => {
        setWaitingSeconds((prev) => {
          const next = prev + 1;
          const fee = next > GRACE_PERIOD_SEC ? Number(((next - GRACE_PERIOD_SEC) * (0.25 / 60)).toFixed(2)) : 0;
          socket.emit('trip:wait_timer', {
            rideId: activeRide.id,
            waitingSeconds: next,
            waitingFee: fee
          });
          return next;
        });
      }, 1000);
    } else {
      setWaitingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isArrived, activeRide?.id]);

  // Chat message socket listeners
  useEffect(() => {
    const handleChat = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };
    socket.on('chat:message', handleChat);
    return () => socket.off('chat:message', handleChat);
  }, []);

  // Format Waiting Timer MM:SS
  const formatWaitTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Actions
  const handleArrived = () => {
    socket.emit('ride:arrived', {
      rideId: activeRide.id,
      driverId: driver.id
    });
    try { sound.playBell(); } catch (e) {}
  };

  const handleStartRide = (e) => {
    e.preventDefault();
    if (enteredOtp.length !== 4) {
      setOtpError('Please enter 4-digit PIN');
      return;
    }
    socket.emit('ride:start', {
      rideId: activeRide.id,
      driverId: driver.id,
      otp: enteredOtp
    });
  };

  const handleCompleteRide = () => {
    socket.emit('ride:complete', {
      rideId: activeRide.id,
      driverId: driver.id,
      waitingFee
    });
  };

  const handleCancelWithReason = (reason) => {
    socket.emit('ride:cancel_reason', {
      rideId: activeRide.id,
      driverId: driver.id,
      reason
    });
    setShowCancelModal(false);
  };

  const handleSendChat = (text) => {
    const msgText = text || chatMessage;
    if (!msgText.trim()) return;
    const msgObj = {
      senderId: driver.id,
      senderName: driver.name,
      senderRole: 'DRIVER',
      text: msgText.trim(),
      timestamp: new Date().toISOString()
    };
    socket.emit('chat:send', { rideId: activeRide.id, message: msgObj });
    setChatMessages((prev) => [...prev, msgObj]);
    setChatMessage('');
  };

  const cancelReasons = [
    'Rider no-show after grace period',
    'Incorrect pickup address',
    'Rider requested cancellation',
    'Vehicle mechanical issue',
    'Unsafe pickup location'
  ];

  const quickDriverReplies = [
    "I have arrived at your pickup spot",
    "Stuck in brief traffic, arriving in 2 min",
    "I'm in the silver Tesla with hazard lights on",
    "Please come to the gate entrance"
  ];

  return (
    <div className="flex flex-col gap-3 pb-24 w-full animate-in slide-in-from-bottom-2">
      
      {/* 1. TOP TURN-BY-TURN HUD MANEUVER BANNER */}
      <div className="glass-card rounded-3xl p-4 border border-blue-500/40 bg-[#121216]/95 shadow-2xl flex flex-col gap-2">
        <div className="flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 shrink-0">
              <Navigation className="w-6 h-6 rotate-45" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
                {activeRide.status} • NAVIGATION HUD
              </span>
              <h3 className="text-sm font-black text-white leading-tight mt-0.5">
                {maneuver.instruction}
              </h3>
              <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                {maneuver.nextStep}
              </p>
            </div>
          </div>

          {/* Speed & Distance Pills */}
          <div className="text-right shrink-0 pl-2">
            <span className="text-lg font-black text-white block">{maneuver.distance}</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1 justify-end">
              <Gauge className="w-3 h-3" /> {maneuver.speed}
            </span>
          </div>
        </div>

        {/* ARRIVAL WAITING TIMER BANNER (Active after Arrived) */}
        {isArrived && (
          <div className={`mt-2 p-3 rounded-2xl border flex items-center justify-between transition-all ${
            isGraceExpired 
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
              : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider block">
                  {isGraceExpired ? 'Grace Period Expired (Paid Waiting)' : 'Free Grace Period (3:00 min)'}
                </span>
                <span className="text-xs font-bold text-white">
                  Waiting Time: <span className="font-mono text-sm font-black">{formatWaitTime(waitingSeconds)}</span>
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Wait Surcharge</span>
              <span className="text-sm font-black text-emerald-400">
                +₹{waitingFee.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. RIDER & TRIP LIFECYCLE ACTION CONTROLS */}
      <div className="glass-card rounded-3xl p-4 border border-white/10 shadow-2xl flex flex-col gap-3">
        
        {/* Rider identity & Call/Chat bar */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white font-black text-sm">
              {activeRide.rider?.name ? activeRide.rider.name[0] : 'P'}
            </div>
            <div>
              <span className="font-black text-white text-sm block">
                {activeRide.rider?.name || 'Alex Johnson'}
              </span>
              <span className="text-[11px] text-gray-400 font-semibold">
                ★ {activeRide.rider?.rating || 4.92} • {activeRide.category}
              </span>
            </div>
          </div>

          {/* Action buttons: Chat, Call, SOS */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className="touch-target p-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 relative transition-all"
              title="Chat with Rider"
            >
              <MessageSquare className="w-4 h-4" />
              {chatMessages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-black" />
              )}
            </button>

            <button
              onClick={() => setShowCallModal(true)}
              className="touch-target p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all"
              title="Masked VoIP Call"
            >
              <Phone className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                socket.emit('ride:sos', {
                  rideId: activeRide.id,
                  driverId: driver.id,
                  location: driver.location
                });
                setSosSent(true);
                setTimeout(() => setSosSent(false), 5000);
              }}
              className="touch-target p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all"
              title="Emergency SOS"
            >
              <Shield className="w-4 h-4" />
            </button>
          </div>
        </div>

        {sosSent && (
          <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold text-center animate-pulse">
            🚨 Emergency SOS Dispatched to Platform Admin & Safety Hub!
          </div>
        )}

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Pickup</span>
            <p className="text-white font-bold truncate mt-0.5">{activeRide.pickup?.address || 'Pickup'}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Destination</span>
            <p className="text-white font-bold truncate mt-0.5">{activeRide.destination?.address || 'Destination'}</p>
          </div>
        </div>

        {/* STATUS STEP 1: TAP WHEN ARRIVED */}
        {activeRide.status === 'ACCEPTED' && (
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleArrived}
              className="touch-target w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" />
              <span>Tap when Arrived at Pickup</span>
            </button>

            <button
              onClick={() => setShowCancelModal(true)}
              className="touch-target py-2 text-center text-xs text-gray-500 hover:text-red-400 font-bold transition-colors"
            >
              Cancel Trip
            </button>
          </div>
        )}

        {/* STATUS STEP 2: VERIFY 4-DIGIT PIN & START */}
        {activeRide.status === 'ARRIVED' && (
          <form onSubmit={handleStartRide} className="flex flex-col gap-2.5 pt-1">
            <div className="text-center">
              <span className="text-xs font-bold text-gray-300">
                Ask passenger for their 4-digit PIN OTP
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  maxLength={4}
                  value={enteredOtp}
                  onChange={(e) => {
                    setEnteredOtp(e.target.value.replace(/\D/g, ''));
                    setOtpError('');
                  }}
                  placeholder="Enter 4-digit PIN"
                  className="w-full pl-9 pr-3 py-3 rounded-2xl bg-black/60 border border-white/20 text-white text-center font-mono font-black text-lg tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={enteredOtp.length !== 4}
                className="touch-target px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black text-xs shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Start Trip</span>
              </button>
            </div>

            {otpError && (
              <p className="text-xs text-red-400 font-bold text-center">{otpError}</p>
            )}

            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="touch-target py-1.5 text-center text-xs text-gray-500 hover:text-red-400 font-bold transition-colors"
            >
              Cancel Trip
            </button>
          </form>
        )}

        {/* STATUS STEP 3: TRIP IN PROGRESS -> COMPLETE & COLLECT */}
        {activeRide.status === 'IN_PROGRESS' && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
              <span className="text-gray-300 font-bold">Total Fare + Surcharges:</span>
              <span className="text-base font-black text-emerald-400">
                ₹{(activeRide.fare + waitingFee).toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleCompleteRide}
              className="touch-target w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm shadow-xl shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5 stroke-[2.5]" />
              <span>Complete Trip & Collect Fare</span>
            </button>
          </div>
        )}
      </div>

      {/* IN-TRIP CHAT DRAWER */}
      {showChat && (
        <div className="glass-card rounded-3xl p-4 border border-white/15 bg-[#121216] shadow-2xl flex flex-col gap-3 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              In-Trip Chat with {activeRide.rider?.name || 'Passenger'}
            </h4>
            <button onClick={() => setShowChat(false)} className="touch-target text-gray-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Message List */}
          <div className="max-h-40 overflow-y-auto space-y-2 p-1 text-xs">
            {chatMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No messages yet. Send a quick update below.</p>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-2xl max-w-[80%] ${
                    msg.senderRole === 'DRIVER'
                      ? 'ml-auto bg-blue-600 text-white'
                      : 'mr-auto bg-white/10 text-gray-200'
                  }`}
                >
                  <p className="font-semibold">{msg.text}</p>
                  <span className="text-[9px] opacity-70 block mt-0.5 text-right font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-1.5">
            {quickDriverReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleSendChat(reply)}
                className="touch-target px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 font-semibold border border-white/5 truncate max-w-full"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Custom text input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Type message..."
              className="flex-1 px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleSendChat()}
              className="touch-target p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MASKED VOIP CALL MODAL */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="glass-card max-w-xs w-full rounded-[36px] p-6 border border-white/20 shadow-2xl flex flex-col items-center text-center gap-6 animate-in zoom-in-95 bg-[#121216]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 text-2xl font-black">
                  {activeRide.rider?.name ? activeRide.rider.name[0] : 'R'}
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{activeRide.rider?.name || 'Alex Johnson'}</h3>
                <p className="text-xs text-emerald-400 font-bold">Masked Driver-Rider VoIP Call</p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono">Encrypted • Phone numbers hidden</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsCallMuted(!isCallMuted)}
                className={`touch-target px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isCallMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isCallMuted ? 'Unmute' : 'Mute'}
              </button>

              <button
                onClick={() => setShowCallModal(false)}
                className="touch-target w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all active:scale-95"
              >
                <Phone className="w-6 h-6 rotate-[135deg]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL TRIP WITH REASON MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-5 border border-white/20 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 bg-[#121216]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Cancel Current Trip</h3>
              <button onClick={() => setShowCancelModal(false)} className="touch-target text-gray-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Please select a cancellation reason. Cancellations after grace period do not impact your cancellation rating.
            </p>

            <div className="flex flex-col gap-2">
              {cancelReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleCancelWithReason(reason)}
                  className="touch-target w-full text-left p-3 rounded-2xl bg-white/5 hover:bg-red-500/20 text-xs font-bold text-gray-200 border border-white/5 hover:border-red-500/40 hover:text-red-300 transition-all"
                >
                  {reason}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCancelModal(false)}
              className="touch-target w-full py-2.5 rounded-xl bg-white/10 text-gray-300 text-xs font-bold hover:text-white"
            >
              Nevermind, Continue Trip
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
