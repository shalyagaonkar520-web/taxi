const TELEGRAM_API_BASE = 'https://api.telegram.org';

function escapeTelegramText(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildRideAcceptedText(ride, driver, rider) {
  const pickup = ride?.pickup?.address || 'Pickup not available';
  const destination = ride?.destination?.address || 'Destination not available';
  const driverName = driver?.name || 'Driver';
  const driverPhone = driver?.phone || 'Not available';
  const vehicle = driver?.vehicle || {};
  const vehicleName = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle not assigned';
  const plate = vehicle.licensePlate || 'N/A';
  const riderName = rider?.name || 'Passenger';
  const fare = Number(ride?.fare || 0).toFixed(2);
  const eta = ride?.etaToPickupMin ? `${ride.etaToPickupMin} min` : 'Checking...';

  return [
    '<b>🚕 Ride Accepted</b>',
    '',
    `Rider: ${escapeTelegramText(riderName)}`,
    `Driver: ${escapeTelegramText(driverName)}`,
    `Phone: ${escapeTelegramText(driverPhone)}`,
    `Vehicle: ${escapeTelegramText(vehicleName)} (${escapeTelegramText(plate)})`,
    `Fare: $${escapeTelegramText(fare)}`,
    `Category: ${escapeTelegramText(ride?.category || 'N/A')}`,
    `Pickup: ${escapeTelegramText(pickup)}`,
    `Destination: ${escapeTelegramText(destination)}`,
    `ETA to pickup: ${escapeTelegramText(eta)}`,
    `Payment: ${escapeTelegramText(ride?.paymentMethod || 'N/A')}`,
    `Security PIN: ${escapeTelegramText(ride?.otp || 'N/A')}`,
    '',
    'Please confirm the ride details and proceed with pickup.'
  ].join('\n');
}

async function sendRideAcceptedNotification(ride, driver, rider) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured.');
    return false;
  }

  if (!ride || !driver) {
    return false;
  }

  const message = buildRideAcceptedText(ride, driver, rider);

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.description || 'Failed to send Telegram message');
    }

    return true;
  } catch (error) {
    console.error('Telegram ride notification failed:', error.message);
    return false;
  }
}

module.exports = {
  buildRideAcceptedText,
  sendRideAcceptedNotification
};
