import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, PhoneCall, Volume2, MessageSquare, CheckCircle, X, Sparkles } from 'lucide-react';
import { socket } from '../../services/socket';
import { sound } from '../../utils/audio';

export default function DriverKeypadCallSimulator({
  driver,
  onRideAccepted
}) {
  const [activeCall, setActiveCall] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [pressedDigit, setPressedDigit] = useState('');
  const [smsReceipt, setSmsReceipt] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Listen to live IVR call sockets from backend
  useEffect(() => {
    const handleIncomingIvrCall = (callData) => {
      setActiveCall(callData);
      setIsAnswered(false);
      setPressedDigit('');
      setSmsReceipt(null);
      setStatusMessage('');
      try { sound.playBell(); } catch (e) {}
    };

    const handleIvrCallEnded = (data) => {
      if (data.confirmationSMS) {
        setSmsReceipt(data.confirmationSMS);
      }
      setStatusMessage(data.messageKannada || data.messageEnglish);
      setTimeout(() => {
        if (!data.confirmationSMS) {
          setActiveCall(null);
        }
      }, 2500);
    };

    socket.on('ivr:incoming_call', handleIncomingIvrCall);
    socket.on('ivr:call_ended', handleIvrCallEnded);

    return () => {
      socket.off('ivr:incoming_call', handleIncomingIvrCall);
      socket.off('ivr:call_ended', handleIvrCallEnded);
    };
  }, []);

  // Quick manual simulation trigger for testing
  const handleSimulateCall = async () => {
    try {
      const res = await fetch('/api/ivr/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverPhone: driver?.phone || '+91 98765 43210',
          driverId: driver?.id || 'driver-01',
          ride: {
            id: `ride-ivr-${Date.now()}`,
            pickup: 'MPN Altius, Padmanabhanagar',
            destination: 'ಕನಕಪುರ ರೋಡ್ (Kanakapura Road)',
            fare: 65,
            riderName: 'ಪ್ರಿಯಾ (Priya)',
            otp: '4928'
          }
        })
      });
      const data = await res.json();
      if (data.call) {
        setActiveCall(data.call);
        setIsAnswered(false);
        setPressedDigit('');
        setSmsReceipt(null);
        try { sound.playBell(); } catch (e) {}
      }
    } catch (e) {
      console.warn('IVR Simulation error:', e);
    }
  };

  // Answer call
  const handleAnswer = () => {
    setIsAnswered(true);
    try {
      // Browser Web Speech synthesis in Kannada / English if supported
      if ('speechSynthesis' in window && activeCall?.promptKannada) {
        const utterance = new SpeechSynthesisUtterance(activeCall.promptKannada);
        utterance.lang = 'kn-IN';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {}
  };

  // Press Keypad DTMF digit
  const handlePressKey = async (digit) => {
    if (!activeCall || !isAnswered) return;
    setPressedDigit(digit);

    try { sound.playBell(); } catch (e) {}

    try {
      const res = await fetch('/api/ivr/keypad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: activeCall.callId,
          digit: digit.toString(),
          driverId: driver?.id || 'driver-01'
        })
      });
      const result = await res.json();

      if (result.action === 'ACCEPTED') {
        setStatusMessage(result.messageKannada);
        setSmsReceipt(result.confirmationSMS);
        try { sound.playTripCompleted(); } catch (e) {}
        if (onRideAccepted && activeCall.ride) {
          onRideAccepted({
            ride: {
              ...activeCall.ride,
              status: 'ACCEPTED',
              driverId: driver?.id || 'driver-01'
            }
          });
        }
      } else if (result.action === 'DECLINED') {
        setStatusMessage(result.messageKannada);
        setTimeout(() => setActiveCall(null), 1500);
      } else {
        setStatusMessage(result.messageKannada || 'ಅಮಾನ್ಯ ಆಯ್ಕೆ');
      }
    } catch (e) {
      console.warn('Keypad send error:', e);
    }
  };

  // Hangup call
  const handleHangup = () => {
    if (activeCall) {
      fetch('/api/ivr/keypad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: activeCall.callId,
          digit: '2',
          driverId: driver?.id || 'driver-01'
        })
      }).catch(() => {});
    }
    setActiveCall(null);
    setIsAnswered(false);
  };

  return (
    <>
      {/* FLOATING TEST SHORTCUT PILL */}
      <div className="fixed top-16 right-3 z-40">
        <button
          onClick={handleSimulateCall}
          className="touch-target px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-black tracking-wide shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
          title="Test Keypad Phone Call Dispatch"
        >
          <PhoneCall className="w-3.5 h-3.5 animate-bounce" />
          <span>ಕೀಪ್ಯಾಡ್ ಫೋನ್ ಕರೆ (Test Keypad Call)</span>
        </button>
      </div>

      {/* KEYPAD PHONE CALL MODAL */}
      {activeCall && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
          
          {/* NOKIA / KEYPAD PHONE CASING */}
          <div className="w-[300px] bg-[#1a1c23] border-4 border-[#323644] rounded-[40px] p-4 shadow-2xl flex flex-col items-center gap-3 relative text-white">
            
            {/* Phone Earpiece */}
            <div className="w-12 h-1.5 rounded-full bg-gray-600 mb-1" />

            {/* MONOCHROME / RETRO PHONE SCREEN */}
            <div className="w-full rounded-2xl bg-[#0e1811] border-2 border-[#1c3823] p-3 flex flex-col gap-2 min-h-[140px] shadow-inner text-[#4edea3] font-mono text-xs">
              
              {/* Status Header */}
              <div className="flex items-center justify-between border-b border-[#1c3823] pb-1 text-[10px]">
                <span className="font-bold flex items-center gap-1">
                  <PhoneCall className="w-3 h-3 animate-pulse" />
                  {isAnswered ? 'ಕರೆ ಚಾಲನೆಯಲ್ಲಿದೆ (Connected)' : 'ಒಳಬರುವ ಕರೆ (Ringing...)'}
                </span>
                <span>2G BSNL</span>
              </div>

              {/* Caller details */}
              <div className="flex flex-col">
                <span className="text-[10px] opacity-80">{activeCall.callerName}</span>
                <span className="text-sm font-black tracking-wider text-white">
                  {activeCall.callerNumber}
                </span>
              </div>

              {/* Voice instruction prompt */}
              {isAnswered ? (
                <div className="p-2 rounded bg-[#0a120c] border border-[#1c3823] text-[10px] leading-relaxed text-[#6ffbbe] animate-pulse">
                  <p className="font-sans font-bold">{activeCall.promptKannada}</p>
                </div>
              ) : (
                <div className="text-[11px] text-amber-300 font-sans font-bold mt-auto animate-bounce text-center">
                  ಹಸಿರು ಬಟನ್ ಒತ್ತಿ ಉತ್ತರಿಸಿ (Press Green to Answer)
                </div>
              )}

              {/* Status feedback */}
              {statusMessage && (
                <div className="text-[10px] font-bold text-white bg-blue-900/60 p-1 rounded">
                  {statusMessage}
                </div>
              )}
            </div>

            {/* CONFIRMATION SMS POPUP ON PHONE SCREEN */}
            {smsReceipt && (
              <div className="w-full p-2.5 rounded-xl bg-yellow-400 text-black text-[10px] font-sans font-bold flex items-start gap-1.5 shadow-lg animate-in zoom-in">
                <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="uppercase font-black text-[9px]">SMS Received:</div>
                  <p className="leading-tight mt-0.5">{smsReceipt}</p>
                </div>
                <button onClick={() => setActiveCall(null)} className="p-0.5 text-black font-black">✕</button>
              </div>
            )}

            {/* CALL ANSWER / HANGUP DUAL BUTTONS */}
            <div className="w-full grid grid-cols-2 gap-3 mt-1">
              {!isAnswered ? (
                <button
                  onClick={handleAnswer}
                  className="touch-target w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Phone className="w-4 h-4" />
                  <span>ಉತ್ತರಿಸಿ (Answer)</span>
                </button>
              ) : (
                <div className="col-span-1 flex items-center justify-center text-[11px] font-bold text-emerald-400">
                  ಕರೆ ಸಂಪರ್ಕಗೊಂಡಿದೆ
                </div>
              )}

              <button
                onClick={handleHangup}
                className={`touch-target w-full py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-95 ${
                  !isAnswered ? 'col-span-1' : 'col-span-1 ml-auto'
                }`}
              >
                <PhoneOff className="w-4 h-4" />
                <span>ಮುಕ್ತಾಯ (End)</span>
              </button>
            </div>

            {/* 3x4 PHYSICAL NUMERIC KEYPAD */}
            <div className="w-full grid grid-cols-3 gap-2 mt-1">
              
              {/* Key 1 (Accept) */}
              <button
                onClick={() => handlePressKey('1')}
                disabled={!isAnswered}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  isAnswered 
                    ? 'bg-[#222530] hover:bg-emerald-600 border-white/20 active:scale-90 text-white' 
                    : 'bg-[#161820] border-white/5 opacity-50 text-gray-500'
                }`}
              >
                <span className="text-base font-black">1</span>
                <span className="text-[8px] font-bold text-emerald-400">ಸ್ವೀಕರಿಸಿ (Accept)</span>
              </button>

              {/* Key 2 (Decline) */}
              <button
                onClick={() => handlePressKey('2')}
                disabled={!isAnswered}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  isAnswered 
                    ? 'bg-[#222530] hover:bg-red-600 border-white/20 active:scale-90 text-white' 
                    : 'bg-[#161820] border-white/5 opacity-50 text-gray-500'
                }`}
              >
                <span className="text-base font-black">2</span>
                <span className="text-[8px] font-bold text-red-400">ತಿರಸ್ಕರಿಸಿ (Decline)</span>
              </button>

              {/* Key 3 */}
              <button
                onClick={() => handlePressKey('3')}
                disabled={!isAnswered}
                className="p-2.5 rounded-xl bg-[#222530] border border-white/10 flex flex-col items-center justify-center text-white active:scale-90 disabled:opacity-50"
              >
                <span className="text-base font-black">3</span>
                <span className="text-[8px] opacity-60">DEF</span>
              </button>

              {/* Keys 4, 5, 6 */}
              {['4 GHI', '5 JKL', '6 MNO', '7 PQRS', '8 TUV', '9 WXYZ', '* +', '0 _', '# ⇪'].map((k) => {
                const [digit, sub] = k.split(' ');
                return (
                  <button
                    key={digit}
                    onClick={() => handlePressKey(digit)}
                    disabled={!isAnswered}
                    className="p-2.5 rounded-xl bg-[#222530] border border-white/10 flex flex-col items-center justify-center text-white active:scale-90 disabled:opacity-50 hover:bg-[#2c303e]"
                  >
                    <span className="text-base font-black">{digit}</span>
                    <span className="text-[8px] opacity-60">{sub}</span>
                  </button>
                );
              })}

            </div>

            <button 
              onClick={() => setActiveCall(null)}
              className="text-[10px] text-gray-400 hover:text-white underline mt-1"
            >
              సిಮ್ಯುಲೇಟರ್ ಮುಚ್ಚಿ (Close Simulator)
            </button>

          </div>

        </div>
      )}
    </>
  );
}
