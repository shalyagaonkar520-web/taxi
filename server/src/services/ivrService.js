const db = require('../db');

// In-memory active IVR calls registry
const activeCalls = new Map();
let ioInstance = null;
// Ride actions are delegated to the socket layer so IVR responses follow the same
// rules as the app (ride claiming, driver status, simulations).
let handlers = { accept: null, decline: null };
const CALL_TTL_MS = 60000;

function setSocketIO(io) {
  ioInstance = io;
}

function setHandlers(next = {}) {
  handlers = { ...handlers, ...next };
}

/**
 * Initiates an IVR phone call dispatch to a driver with a basic keypad phone
 */
function initiateKeypadDispatch({ driverPhone, driverId, ride }) {
  const callId = `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const promptKannada = `ಹೊಸ ಸವಾರಿ ಬುಕಿಂಗ್: ${ride?.pickup || 'ಪದ್ಮನಾಭನಗರ'} ನಿಂದ ${ride?.destination || 'ಕನಕಪುರ ರೋಡ್'}. ದರ ರೂಪಾಯಿ ${ride?.fare || 65}. ಸ್ವೀಕರಿಸಲು 1 ಒತ್ತಿ. ತಿರಸ್ಕರಿಸಲು 2 ಒತ್ತಿ.`;
  const promptEnglish = `New ride booking: from ${ride?.pickup || 'Padmanabhanagar'} to ${ride?.destination || 'Kanakapura Road'}. Fare ${ride?.fare || 65} Rupees. Press 1 to Accept. Press 2 to Decline.`;

  const callData = {
    callId,
    driverId: driverId || 'driver-01',
    driverPhone: driverPhone || '+91 98765 43210',
    callerNumber: '+91 80 4000 1234',
    callerName: 'ನಮ್ಮ ಡ್ರೈವರ್ ಸಹಾಯವಾಣಿ (NexRide IVR)',
    ride: ride || {
      id: `ride-ivr-${Date.now()}`,
      pickup: 'MPN Altius, Padmanabhanagar',
      destination: 'ಕನಕಪುರ ರೋಡ್ (Kanakapura Road)',
      fare: 65,
      riderName: 'ಪ್ರಿಯಾ (Priya)',
      otp: '4928'
    },
    promptKannada,
    promptEnglish,
    status: 'RINGING',
    startedAt: new Date().toISOString()
  };

  activeCalls.set(callId, callData);
  // Unanswered calls expire so the registry cannot grow without bound.
  setTimeout(() => activeCalls.delete(callId), CALL_TTL_MS).unref();

  // Broadcast to driver via WebSocket
  try {
    if (ioInstance) {
      ioInstance.to(`user:${callData.driverId}`).emit('ivr:incoming_call', callData);
    }
  } catch (e) {
    console.warn('Socket broadcast warning in IVR:', e.message);
  }

  return callData;
}

/**
 * Handles DTMF keypad digit input from the driver's phone
 */
function handleKeypadInput({ callId, digit, driverId }) {
  const call = activeCalls.get(callId);
  if (!call) {
    return { success: false, error: 'Call not found or already expired' };
  }
  if (driverId && driverId !== call.driverId) {
    return { success: false, error: 'This call belongs to a different driver' };
  }

  if (digit === '1') {
    // Driver Pressed 1: ACCEPT RIDE
    call.status = 'ACCEPTED';
    const ride = call.ride;

    // Real rides are accepted through the same path as the app; demo calls have no ride record.
    const realRide = ride && ride.id ? db.getRideById(ride.id) : null;
    if (realRide && handlers.accept) {
      Promise.resolve(handlers.accept(realRide.id, call.driverId)).catch((e) =>
        console.warn('IVR ride accept failed:', e.message)
      );
    }

    // The security PIN stays with the rider; it is only echoed for the built-in demo ride.
    const pinText = realRide ? '' : ` ಒಟಿಪಿ: ${ride?.otp || '4928'}.`;
    const confirmationSMS = `NEXRIDE: ಸವಾರಿ ದೃಢಪಟ್ಟಿದೆ! ಪ್ರಯಾಣಿಕರು: ${ride?.riderName || 'ಪ್ರಿಯಾ'}. ಪಿಕಪ್: ${ride?.pickup || 'MPN Altius'}.${pinText} ಶುಲ್ಕ: ₹${ride?.fare || 65}.`;

    const result = {
      success: true,
      action: 'ACCEPTED',
      callId,
      messageKannada: 'ಸವಾರಿಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ವಿವರಗಳನ್ನು SMS ಮೂಲಕ ಕಳುಹಿಸಲಾಗಿದೆ.',
      messageEnglish: 'Ride accepted successfully. Details dispatched via SMS.',
      confirmationSMS
    };

    try {
      if (ioInstance) {
        ioInstance.to(`user:${call.driverId}`).emit('ivr:call_ended', result);
      }
    } catch (e) {}

    activeCalls.delete(callId);
    return result;

  } else if (digit === '2') {
    // Driver Pressed 2: DECLINE RIDE
    call.status = 'DECLINED';
    if (call.ride?.id && handlers.decline) {
      Promise.resolve(handlers.decline(call.ride.id, call.driverId)).catch(() => {});
    }
    const result = {
      success: true,
      action: 'DECLINED',
      callId,
      messageKannada: 'ಸವಾರಿಯನ್ನು ತಿರಸ್ಕರಿಸಲಾಗಿದೆ. ಕರೆ ಮುಕ್ತಾಯಗೊಂಡಿದೆ.',
      messageEnglish: 'Ride was declined. Call disconnected.'
    };

    try {
      if (ioInstance) {
        ioInstance.to(`user:${call.driverId}`).emit('ivr:call_ended', result);
      }
    } catch (e) {}

    activeCalls.delete(callId);
    return result;

  } else {
    return {
      success: false,
      action: 'INVALID_INPUT',
      callId,
      messageKannada: 'ಅಮಾನ್ಯ ಆಯ್ಕೆ. ದಯವಿಟ್ಟು 1 ಅಥವಾ 2 ಒತ್ತಿ.',
      messageEnglish: 'Invalid choice. Please press 1 to accept or 2 to decline.'
    };
  }
}

/**
 * Returns currently ringing or active calls
 */
function getActiveCalls(driverId) {
  return Array.from(activeCalls.values()).filter((call) => !driverId || call.driverId === driverId);
}

module.exports = {
  setSocketIO,
  setHandlers,
  initiateKeypadDispatch,
  handleKeypadInput,
  getActiveCalls
};
