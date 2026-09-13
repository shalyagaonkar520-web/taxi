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

app.use(express.json());

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
  res.json(user);
});

app.patch('/api/users/:id', (req, res) => {
  const { name, email, phone, avatar } = req.body || {};
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
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

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
        lat: parseFloat(lat) + off.dLat,
        lng: parseFloat(lng) + off.dLng,
        heading: off.heading
      },
      status: 'ONLINE'
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
    const { pickup, destination } = req.body;
    if (!pickup || !destination) {
      return res.status(400).json({ error: 'Pickup and destination are required' });
    }

    const settings = db.getSettings();
    const route = await getDrivingRoute(pickup, destination);
    const quotes = getFareQuotes({
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      surgeMultiplier: settings.surgeMultiplier
    });

    res.json({
      route,
      quotes,
      surgeMultiplier: settings.surgeMultiplier,
      city: settings.city
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
  const { userId, amount, paymentMethod = 'Card' } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newBalance = Number(((user.walletBalance || 0) + parseFloat(amount)).toFixed(2));
  db.updateUser(userId, { walletBalance: newBalance });

  const tx = db.addTransaction({
    userId,
    amount: parseFloat(amount),
    type: 'WALLET_TOPUP',
    description: `Wallet Top-Up via ${paymentMethod}`
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
  const platformRevenue = completed.reduce((sum, r) => sum + (r.platformFee || (r.fare * 0.2)), 0);

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
  const updated = db.updateSettings(req.body);
  io.emit('settings:updated', updated);
  res.json(updated);
});

async function startServer() {
  await db.initialize();
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
