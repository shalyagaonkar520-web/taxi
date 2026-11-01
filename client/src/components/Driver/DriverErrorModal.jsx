import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function DriverErrorModal({
  isOpen,
  onClose,
  title,
  message,
  currentLanguage = 'kn'
}) {
  if (!isOpen) return null;

  const isKannada = currentLanguage === 'kn';

  const defaultTitle = isKannada 
    ? 'ಸ್ಥಿತಿಯನ್ನು ಬದಲಾಯಿಸಲು ಸಾಧ್ಯವಾಗಿಲ್ಲ'
    : 'Could not change status';

  const defaultMessage = isKannada 
    ? 'ಈ ಕಾರ್ಯವನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ನಮಗೆ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ನೆಟ್‌ವರ್ಕ್ ಪರಿಶೀಲಿಸಿ ನಂತರ ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.'
    : 'We were unable to complete this action. Please check your network connection and try again.';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in">
      <div className="bg-white text-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
        
        <h3 className="text-lg font-black text-gray-950 tracking-tight leading-snug">
          {title || defaultTitle}
        </h3>

        <p className="text-xs text-gray-600 leading-relaxed">
          {message || defaultMessage}
        </p>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="touch-target px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-md active:scale-95"
          >
            {isKannada ? 'ಸರಿ' : 'OK'}
          </button>
        </div>

      </div>
    </div>
  );
}
