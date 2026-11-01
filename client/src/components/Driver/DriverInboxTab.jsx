import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle, 
  Flame, 
  ShieldCheck, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  Check, 
  Trash2 
} from 'lucide-react';

export default function DriverInboxTab({
  driver,
  currentLanguage = 'kn'
}) {
  const isKannada = currentLanguage === 'kn';

  const [messages, setMessages] = useState([
    {
      id: 1,
      title: isKannada ? '0% ಕಮಿಷನ್ ಪಾಸ್ ಸಕ್ರಿಯವಾಗಿದೆ' : '0% Commission Pass is Active',
      desc: isKannada ? 'ನಿಮ್ಮ 24 ಗಂಟೆಗಳ ಅನ್‌ಲಿಮಿಟೆಡ್ ಪಾಸ್ ಯಶಸ್ವಿಯಾಗಿ ಸಕ್ರಿಯಗೊಂಡಿದೆ. ಯಾವುದೇ ಕಮಿಷನ್ ಇಲ್ಲದೆ ಸವಾರಿಗಳನ್ನು ಮಾಡಿ.' : 'Your 24-hour unlimited pass is active. Keep 100% of your earnings!',
      time: '10 min ago',
      read: false,
      tag: 'PASS',
      icon: 'check'
    },
    {
      id: 2,
      title: isKannada ? 'ಪೀಕ್ ಅವರ್ ಬೋನಸ್ ಅವಕಾಶ!' : 'Evening Peak Hour Bonus!',
      desc: isKannada ? 'ಸಂಜೆ 5 ರಿಂದ 9 ರವರೆಗೆ 5 ಸವಾರಿಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ ₹150 ಹೆಚ್ಚುವರಿ ನಗದು ಬಹುಮಾನವನ್ನು ಪಡೆಯಿರಿ.' : 'Complete 5 rides between 5:00 PM and 9:00 PM to earn an extra ₹150.',
      time: '1h ago',
      read: false,
      tag: 'BONUS',
      icon: 'flame'
    },
    {
      id: 3,
      title: isKannada ? 'ಸುರಕ್ಷತೆ ಮೊದಲು (Safety First)' : 'Safety Guidelines Briefing',
      desc: isKannada ? 'ಗ್ರಾಹಕರ ಮತ್ತು ನಿಮ್ಮ ಸುರಕ್ಷತೆ ನಮಗೆ ಮುಖ್ಯ. ದಯವಿಟ್ಟು ನಿಯಮಗಳನ್ನು ಅನುಸರಿಸಿ, ಸುರಕ್ಷಿತವಾಗಿ ಚಾಲನೆ ಮಾಡಿ.' : 'Ensure safe driving at all times. Check customer OTP before starting trips.',
      time: '3h ago',
      read: false,
      tag: 'SAFETY',
      icon: 'shield'
    },
    {
      id: 4,
      title: isKannada ? 'ನಿಮ್ಮ ನಿನ್ನೆಯ ಗಳಿಕೆ ಜಮೆಯಾಗಿದೆ' : 'Yesterday Payout Credited',
      desc: isKannada ? 'ನಿಮ್ಮ ಖಾತೆಗೆ ₹840 ಯಶಸ್ವಿಯಾಗಿ ಜಮೆಯಾಗಿದೆ. ಯುಟಿಆರ್: HDFC8901237721' : '₹840 has been credited to your bank account via IMPS/UPI.',
      time: 'Yesterday',
      read: false,
      tag: 'PAYOUT',
      icon: 'dollar'
    },
    {
      id: 5,
      title: isKannada ? 'ಹೊಸ ಸೇವೆ: ಪ್ಯಾಕೇಜ್ ಡೆಲಿವರಿ' : 'New Feature: Package Delivery',
      desc: isKannada ? 'ಬೆಂಗಳೂರು ಸೌತ್‌ನಲ್ಲಿ ಈಗ ಪ್ಯಾಕೇಜ್ ಡೆಲಿವರಿ ಲಭ್ಯವಿದೆ. ನಿಮ್ಮ ಆದ್ಯತೆಗಳಲ್ಲಿ ಸಕ್ರಿಯಗೊಳಿಸಿ.' : 'Express package delivery is now live in Bengaluru South. Toggle it in Preferences.',
      time: '2 days ago',
      read: false,
      tag: 'FEATURE',
      icon: 'package'
    },
    {
      id: 6,
      title: isKannada ? 'ವಿಮೆ ನವೀಕರಣ ಜ್ಞಾಪನೆ' : 'Insurance Renewal Notice',
      desc: isKannada ? 'ನಿಮ್ಮ ವಾಣಿಜ್ಯ ವಾಹನ ವಿಮೆ 36 ದಿನಗಳಲ್ಲಿ ಮುಕ್ತಾಯಗೊಳ್ಳುತ್ತದೆ. ಸುಲಭವಾಗಿ ನವೀಕರಿಸಿ.' : 'Commercial policy expires in 36 days. Upload renewed copy to keep driving.',
      time: '3 days ago',
      read: false,
      tag: 'ALERT',
      icon: 'alert'
    }
  ]);

  const [selectedMsg, setSelectedMsg] = useState(null);

  const markAllRead = () => {
    setMessages(prev => prev.map(m => ({ ...m, read: true })));
  };

  const markSingleRead = (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  };

  const unreadCount = messages.filter(m => !m.read).length;

  const renderIcon = (type) => {
    switch (type) {
      case 'check':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'flame':
        return <Flame className="w-5 h-5 text-amber-400" />;
      case 'shield':
        return <ShieldCheck className="w-5 h-5 text-blue-400" />;
      case 'dollar':
        return <DollarSign className="w-5 h-5 text-teal-400" />;
      case 'package':
        return <Package className="w-5 h-5 text-purple-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-orange-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-28 w-full max-w-md mx-auto text-white animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">
              {isKannada ? 'ಇನ್‌ಬಾಕ್ಸ್' : 'Inbox'}
            </h1>
            <p className="text-[11px] text-gray-400">
              {unreadCount > 0 
                ? (isKannada ? `${unreadCount} ಹೊಸ ಸಂದೇಶಗಳು` : `${unreadCount} unread messages`)
                : (isKannada ? 'ಎಲ್ಲಾ ಸಂದೇಶಗಳನ್ನು ಓದಲಾಗಿದೆ' : 'All caught up')}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="touch-target text-xs font-bold text-blue-400 hover:text-blue-300 p-1"
          >
            {isKannada ? 'ಎಲ್ಲವನ್ನೂ ಗುರುತಿಸಿ' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* MESSAGES LIST */}
      <div className="flex flex-col gap-2 mt-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            onClick={() => {
              markSingleRead(msg.id);
              setSelectedMsg(msg);
            }}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative ${
              msg.read
                ? 'bg-[#121218] border-white/5 opacity-75 hover:opacity-100'
                : 'bg-[#181822] border-blue-500/30 shadow-md ring-1 ring-blue-500/20'
            }`}
          >
            {/* Icon wrapper */}
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
              {renderIcon(msg.icon)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h3 className={`text-xs truncate ${msg.read ? 'font-bold text-gray-300' : 'font-black text-white'}`}>
                  {msg.title}
                </h3>
                <span className="text-[10px] text-gray-500 shrink-0 font-medium">{msg.time}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                {msg.desc}
              </p>
            </div>

            {!msg.read && (
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
            )}
          </div>
        ))}
      </div>

      {/* MESSAGE DETAILS MODAL */}
      {selectedMsg && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl p-5 border border-white/20 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 bg-[#121218]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                {selectedMsg.tag}
              </span>
              <button onClick={() => setSelectedMsg(null)} className="touch-target p-1 text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center">
                {renderIcon(selectedMsg.icon)}
              </div>
              <div>
                <h3 className="text-sm font-black text-white">{selectedMsg.title}</h3>
                <span className="text-[10px] text-gray-400">{selectedMsg.time}</span>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-black/30 p-3.5 rounded-2xl border border-white/5">
              {selectedMsg.desc}
            </p>

            <button
              onClick={() => setSelectedMsg(null)}
              className="touch-target w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all"
            >
              {isKannada ? 'ಮುಚ್ಚಿ' : 'Close'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
