const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

dotenv.config();

const db = require('./db');
const { getFareQuotes, calculateFare, VEHICLE_TIERS } = require('./services/pricing');
const { getDrivingRoute, searchPlaces, reverseGeocode, calculateHaversineDistance } = require('./services/routing');
const { setupSocketIO } = require('./socket');
const ivrService = require('./services/ivrService');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nexride.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let firebaseAuth = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(serviceAccount) });
    firebaseAuth = getAuth();
  } catch (err) {
    console.error('Firebase Admin configuration is invalid:', err.message);
  }
} else if (process.env.FIREBASE_PROJECT_ID) {
  try {
    // ID-token verification uses Firebase's public signing keys; no private service account is needed.
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    firebaseAuth = getAuth();
  } catch (err) {
    console.error('Firebase project configuration is invalid:', err.message);
  }
}

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Enable CORS for the configured frontend origins.
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));

app.use(express.json({ limit: '2mb' }));

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// ---------------- REST API ROUTES ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    driversOnline: db.getDrivers().filter(d => d.status === 'ONLINE').length,
    activeRides: db.getRides().filter(r => ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)).length
  });
});

// Login for one role at a time. Admin credentials are environment-only.
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body || {};
  const normalizedRole = String(role || '').toUpperCase();

  if (!email || !password || !['RIDER', 'DRIVER', 'ADMIN'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  let user = null;
  if (normalizedRole === 'ADMIN') {
    if (ADMIN_PASSWORD && email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      user = db.sanitizeUser(db.getUserById('admin-01'));
    }
  } else {
    user = db.authenticateUser(email, password, normalizedRole);
  }

  if (!user) return res.status(401).json({ error: 'Invalid credentials for this workspace' });
  res.json({ user: { ...user, role: normalizedRole } });
});

app.post('/api/auth/firebase', async (req, res) => {
  if (!firebaseAuth) return res.status(503).json({ error: 'Firebase authentication is not configured on the server' });

  const { idToken, role, profile } = req.body || {};
  const normalizedRole = String(role || '').toUpperCase();
  if (!idToken || !['RIDER', 'DRIVER', 'ADMIN'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'A Firebase token and valid role are required' });
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const email = String(decoded.email || '').toLowerCase();
    if (!email || decoded.email_verified === false) {
      return res.status(401).json({ error: 'A verified Firebase account is required' });
    }
    if (normalizedRole === 'ADMIN' && email !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: 'This account is not the NexRide admin account' });
    }

    const user = normalizedRole === 'ADMIN'
      ? db.sanitizeUser(db.getUserById('admin-01'))
      : db.upsertFirebaseUser({
          uid: decoded.uid,
          email,
          name: profile?.name || decoded.name,
          picture: profile?.picture || decoded.picture
        }, normalizedRole);

    if (!user) return res.status(403).json({ error: 'This account is assigned to another workspace' });
    res.json({ user: { ...user, role: normalizedRole } });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired Firebase token' });
  }
});

// Users & Demo accounts
app.get('/api/users', (req, res) => {
  res.json(db.getUsers());
});

app.get('/api/users/:id', (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(db.sanitizeUser(user));
});

app.patch('/api/users/:id', (req, res) => {
  const { name, email, phone, avatar } = req.body || {};
  if (typeof email === 'string' && email.trim() && db.isEmailTaken(email.trim(), req.params.id)) {
    return res.status(409).json({ error: 'That email is already in use' });
  }
  const user = db.updateUser(req.params.id, {
    ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
    ...(typeof email === 'string' && email.trim() ? { email: email.trim().toLowerCase() } : {}),
    ...(typeof phone === 'string' ? { phone: phone.trim() } : {}),
    ...(typeof avatar === 'string' ? { avatar: avatar.trim() } : {})
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: db.sanitizeUser(user) });
});

app.post('/api/users/:id/password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Current password and a new password of at least 8 characters are required' });
  }
  const user = db.changePassword(req.params.id, currentPassword, newPassword);
  if (!user) return res.status(401).json({ error: 'Current password is incorrect or this account uses Firebase' });
  res.json({ user });
});

// Drivers list
app.get('/api/drivers', (req, res) => {
  res.json(db.getDrivers());
});

// Relocate drivers around user location
app.post('/api/drivers/relocate', (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }

  const drivers = db.getDrivers();
  const offsets = [
    { dLat: 0.005, dLng: 0.004, heading: 45 },
    { dLat: -0.004, dLng: 0.006, heading: 135 },
    { dLat: -0.006, dLng: -0.005, heading: 225 },
    { dLat: 0.004, dLng: -0.006, heading: 315 }
  ];

  drivers.forEach((driver, idx) => {
    const off = offsets[idx % offsets.length];
    db.updateDriver(driver.id, {
      location: {
        lat: lat + off.dLat,
        lng: lng + off.dLng,
        heading: off.heading
      },
      ...(driver.status === 'BUSY' ? {} : { status: 'ONLINE' })
    });
  });

  const updatedDrivers = db.getDrivers();
  io.emit('init:state', { drivers: updatedDrivers });
  res.json(updatedDrivers);
});

// Places Autocomplete / Geocoding
app.get('/api/places/search', async (req, res) => {
  try {
    const { q, lat, lng } = req.query;
    if (!q || !String(q).trim()) return res.json([]);
    const places = await searchPlaces(q, parseFloat(lat), parseFloat(lng));
    res.json(places);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/places/nearby', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const category = String(req.query.category || 'tourism');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }
  try {
    const queries = category === 'food'
      ? ['restaurant', 'cafe', 'food court']
      : ['park', 'museum', 'mall', 'airport', 'train station', 'tourist attraction'];
    const results = (await Promise.all(queries.map(query => searchPlaces(query, lat, lng))))
      .flat()
      .filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lng))
      .map(place => ({
        ...place,
        distanceKm: Number(calculateHaversineDistance(lat, lng, place.lat, place.lng).toFixed(1))
      }))
      .filter(place => place.distanceKm <= 50)
      .filter((place, index, places) => places.findIndex(other => other.name === place.name) === index)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 12);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Nearby places are temporarily unavailable' });
  }
});

// Reverse Geocode (Get address from current coordinates)
app.get('/api/places/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const place = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json(place);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Calculate Route & Fare Quotes
app.post('/api/rides/quotes', async (req, res) => {
  try {
    const { pickup, destination } = req.body || {};
    if (!pickup || !destination) {
      return res.status(400).json({ error: 'Pickup and destination are required' });
    }
    if (![pickup.lat, pickup.lng, destination.lat, destination.lng].every((n) => Number.isFinite(Number(n)))) {
      return res.status(400).json({ error: 'Pickup and destination need valid coordinates' });
    }

    const settings = db.getSettings();
    const route = await getDrivingRoute(pickup, destination);
    const location = settings.city || pickup?.address || destination?.address || '';
    const quotes = getFareQuotes({
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      surgeMultiplier: settings.surgeMultiplier,
      location,
      currencyCode: settings.currencyCode || null
    });

    res.json({
      route,
      quotes,
      surgeMultiplier: settings.surgeMultiplier,
      city: settings.city,
      currency: quotes[0]?.currency || settings.currencySymbol || '$',
      currencyCode: quotes[0]?.currencyCode || settings.currencyCode || 'USD',
      currencyLocale: quotes[0]?.currencyLocale || settings.currencyLocale || 'en-US'
    });
  } catch (err) {
    console.error('Error generating quotes:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user ride history
app.get('/api/rides/history/:userId', (req, res) => {
  const rides = db.getRides().filter(r => r.riderId === req.params.userId || r.driverId === req.params.userId);
  res.json(rides);
});

// Get active ride for user
app.get('/api/rides/active/:userId', (req, res) => {
  const activeRide = db.getActiveRideForUser(req.params.userId);
  res.json(activeRide || null);
});

// Wallet Balance & Transactions
app.get('/api/wallet/:userId', (req, res) => {
  const user = db.getUserById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const transactions = db.getUserTransactions(req.params.userId);
  res.json({
    balance: user.walletBalance || 0,
    transactions
  });
});

// Top-up wallet
app.post('/api/wallet/topup', (req, res) => {
  const { userId, paymentMethod = 'Card' } = req.body || {};
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    return res.status(400).json({ error: 'Amount must be between 0.01 and 10000' });
  }

  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newBalance = Number(((user.walletBalance || 0) + amount).toFixed(2));
  db.updateUser(userId, { walletBalance: newBalance });

  const tx = db.addTransaction({
    userId,
    amount: Number(amount.toFixed(2)),
    type: 'WALLET_TOPUP',
    description: `Wallet Top-Up via ${String(paymentMethod).slice(0, 40)}`
  });

  res.json({
    balance: newBalance,
    transaction: tx
  });
});

// Admin Metrics & God-View
app.get('/api/admin/metrics', (req, res) => {
  const rides = db.getRides();
  const drivers = db.getDrivers();
  const completed = rides.filter(r => r.status === 'COMPLETED');
  
  const totalRevenue = completed.reduce((sum, r) => sum + (r.fare || 0), 0);
  const platformRevenue = completed.reduce((sum, r) => sum + (r.platformFee ?? ((r.fare || 0) * 0.2)), 0);

  res.json({
    totalRides: rides.length,
    completedRides: completed.length,
    activeRides: rides.filter(r => ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)).length,
    totalDrivers: drivers.length,
    onlineDrivers: drivers.filter(d => d.status === 'ONLINE').length,
    busyDrivers: drivers.filter(d => d.status === 'BUSY').length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    platformRevenue: Number(platformRevenue.toFixed(2)),
    settings: db.getSettings(),
    recentRides: rides.slice(0, 10)
  });
});

// Update Admin Settings (Surge, Commission)
app.post('/api/admin/settings', (req, res) => {
  let updated;
  try {
    updated = db.updateSettings(req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  io.emit('settings:updated', updated);
  res.json(updated);
});

// Malformed JSON bodies and other middleware errors should be 4xx JSON, not HTML stack traces.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// ---------------- DRIVER DASHBOARD API ----------------

// Wraps a driver route: resolves the driver (404 if unknown) and turns thrown errors into JSON.
function driverRoute(handler, errorStatus = 500) {
  return (req, res) => {
    try {
      const driver = db.resolveDriver(req.params.id);
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      return res.json(handler(driver, req));
    } catch (err) {
      return res.status(errorStatus).json({ error: err.message });
    }
  };
}

// Demand surge zones shown on the driver map
app.get('/api/driver/heatmap', (req, res) => {
  res.json(db.getDriverHeatmap());
});

app.get('/api/driver/:id/summary', driverRoute((driver) => db.getDriverSummary(driver.id)));

app.get('/api/driver/:id/earnings', driverRoute((driver, req) =>
  db.getDriverEarnings(driver.id, req.query.range === 'day' ? 'day' : 'week')
));

app.post('/api/driver/:id/cashout', driverRoute((driver, req) =>
  db.recordCashout(driver.id, req.body?.amount, String(req.body?.method || 'INSTANT_BANK').slice(0, 40)),
  400
));

app.get('/api/driver/:id/quests', driverRoute((driver) => db.getDriverQuests(driver.id)));

app.post('/api/driver/:id/quests', driverRoute((driver, req) =>
  db.claimQuest(driver.id, req.body?.questId),
  400
));

app.get('/api/driver/:id/kyc', driverRoute((driver) => db.getDriverKyc(driver.id)));

app.post('/api/driver/:id/kyc', driverRoute((driver, req) => {
  const { docType, data } = req.body || {};
  // Only document metadata may be updated by the driver; verification status is server-controlled.
  const allowed = ['fileUrl', 'docNumber', 'expiryDate', 'fileName'];
  const safeData = Object.fromEntries(
    Object.entries(data || {}).filter(([key, value]) => allowed.includes(key) && typeof value === 'string')
  );
  return db.updateDriverKyc(driver.id, docType, safeData);
}, 400));

app.get('/api/driver/:id/destination', driverRoute((driver) => db.getDriverDestination(driver.id)));

app.post('/api/driver/:id/destination', driverRoute((driver, req) =>
  db.setDriverDestination(driver.id, {
    enabled: Boolean(req.body?.enabled),
    destination: req.body?.destination || null
  }),
  400
));

// ---------------- IVR KEYPAD DISPATCH (demo simulator) ----------------

app.post('/api/ivr/dispatch', (req, res) => {
  try {
    const { driverPhone, driverId, ride } = req.body || {};
    res.json({ success: true, call: ivrService.initiateKeypadDispatch({ driverPhone, driverId, ride }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ivr/keypad', (req, res) => {
  const { callId, digit, driverId } = req.body || {};
  if (!callId || !digit) {
    return res.status(400).json({ error: 'callId and digit are required' });
  }
  res.json(ivrService.handleKeypadInput({ callId, digit: String(digit), driverId }));
});

app.get('/api/ivr/calls', (req, res) => {
  if (!req.query.driverId) return res.status(400).json({ error: 'driverId is required' });
  res.json({ calls: ivrService.getActiveCalls(String(req.query.driverId)) });
});

async function startServer() {
  await db.initialize();
  ivrService.setSocketIO(io);
  setupSocketIO(io);
  server.listen(PORT, () => {
    console.log(`NexRide Server running on port ${PORT}`);
    console.log(`WebSocket ready on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to initialize NexRide:', err);
  process.exit(1);
});
