const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const db = require('./db');
const { getFareQuotes, calculateFare, VEHICLE_TIERS } = require('./services/pricing');
const { getDrivingRoute, searchPlaces, reverseGeocode } = require('./services/routing');
const { setupSocketIO } = require('./socket');
const ivrService = require('./services/ivrService');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexride-secure-production-jwt-token-key-2026';

// Enable CORS for frontend Vite client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));

app.use(express.json());

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

setupSocketIO(io);
ivrService.setSocketIO(io);

// ---------------- AUTHENTICATION & ROLE GUARDS ----------------

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyTokenMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

// Login endpoint: supports email+password or fast demo role login ({ role: 'RIDER' | 'DRIVER' | 'ADMIN' })
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;

  let user = null;
  if (role) {
    const users = db.getUsers();
    user = users.find(u => u.role.toUpperCase() === role.toUpperCase());
    if (!user) {
      // Driver might be in driver table
      const drivers = db.getDrivers();
      user = drivers.find(d => d.role.toUpperCase() === role.toUpperCase());
    }
  } else if (email) {
    user = db.getUserByEmail(email);
    if (!user) {
      const driver = db.getDrivers().find(d => d.email.toLowerCase() === email.toLowerCase());
      if (driver) {
        user = {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          role: 'DRIVER',
          phone: driver.phone,
          rating: driver.rating,
          walletBalance: driver.walletBalance,
          avatar: driver.avatar
        };
      }
    }
  }

  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  const safeUser = db.getUserById(user.id) || user;
  const token = generateToken(safeUser);

  res.json({
    token,
    user: safeUser
  });
});

// Current user profile
app.get('/api/auth/me', verifyTokenMiddleware, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
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

// Users & Demo accounts
app.get('/api/users', (req, res) => {
  res.json(db.getUsers());
});

app.get('/api/users/:id', (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
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

// ---------------- DRIVER EXTENSION REST API ----------------

// Driver Summary
app.get('/api/driver/:id/summary', (req, res) => {
  try {
    const summary = db.getDriverSummary(req.params.id);
    if (!summary) return res.status(404).json({ error: 'Driver summary not found' });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Driver Earnings & Breakdown
app.get('/api/driver/:id/earnings', (req, res) => {
  try {
    const range = req.query.range === 'day' ? 'day' : 'week';
    const earnings = db.getDriverEarnings(req.params.id, range);
    res.json(earnings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Instant Cash Out
app.post('/api/driver/:id/cashout', (req, res) => {
  try {
    const { amount, method } = req.body;
    const result = db.recordCashout(req.params.id, amount, method);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Demand Surge Heatmap
app.get('/api/driver/heatmap', (req, res) => {
  try {
    const heatmap = db.getDriverHeatmap();
    res.json(heatmap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Driver Quests & Incentives
app.get('/api/driver/:id/quests', (req, res) => {
  try {
    const quests = db.getDriverQuests(req.params.id);
    res.json(quests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/driver/:id/quests', (req, res) => {
  try {
    const { questId } = req.body;
    const result = db.claimQuest(req.params.id, questId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Driver KYC
app.get('/api/driver/:id/kyc', (req, res) => {
  try {
    const kyc = db.getDriverKyc(req.params.id);
    res.json(kyc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/driver/:id/kyc', (req, res) => {
  try {
    const { docType, data } = req.body;
    const updated = db.updateDriverKyc(req.params.id, docType, data || {});
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Driver Destination Mode
app.get('/api/driver/:id/destination', (req, res) => {
  try {
    const dest = db.getDriverDestination(req.params.id);
    res.json(dest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/driver/:id/destination', (req, res) => {
  try {
    const { enabled, destination } = req.body;
    const result = db.setDriverDestination(req.params.id, { enabled, destination });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Local Mock IVR Dispatcher Endpoints for Keypad Feature Phones ---
const { initiateKeypadDispatch, handleKeypadInput, getActiveCalls } = require('./services/ivrService');

app.post('/api/ivr/dispatch', (req, res) => {
  try {
    const { driverPhone, driverId, ride } = req.body;
    const callData = initiateKeypadDispatch({ driverPhone, driverId, ride });
    res.json({ success: true, call: callData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ivr/keypad', (req, res) => {
  try {
    const { callId, digit, driverId } = req.body;
    const result = handleKeypadInput({ callId, digit, driverId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ivr/calls', (req, res) => {
  res.json({ calls: getActiveCalls() });
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

// Calculate Route & Fare Quotes across all 7 vehicle tiers
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

// Get all platform rides
app.get('/api/rides', (req, res) => {
  res.json(db.getRides());
});

// Get user ride history
app.get('/api/rides/history/:userId', (req, res) => {
  const userId = req.params.userId;
  const driver = db.getDriverById(userId);
  const driverId = driver ? driver.id : userId;
  const driverUserId = driver?.userId || userId;

  const rides = db.getRides().filter(r => 
    r.riderId === userId || 
    r.driverId === userId || 
    r.driverId === driverId || 
    r.driverId === driverUserId
  );
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

  const tx = db.addTransaction({
    userId,
    amount: parseFloat(amount),
    type: 'WALLET_TOPUP',
    description: `Wallet Top-Up via ${paymentMethod}`
  });

  const updatedUser = db.getUserById(userId);

  res.json({
    balance: updatedUser ? updatedUser.walletBalance : (user.walletBalance + parseFloat(amount)),
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

// ---------------- IVR TELEPHONY & KEYPAD DISPATCH ROUTES ----------------

// Initiate automated call to keypad phone
app.post('/api/ivr/dispatch', (req, res) => {
  const { driverPhone, driverId, ride } = req.body;
  const call = ivrService.initiateKeypadDispatch({ driverPhone, driverId, ride });
  res.json({ success: true, call });
});

// Process DTMF keypad press (1: Accept, 2: Decline)
app.post('/api/ivr/keypad', (req, res) => {
  const { callId, digit, driverId } = req.body;
  if (!callId || !digit) {
    return res.status(400).json({ error: 'callId and digit are required' });
  }
  const result = ivrService.handleKeypadInput({ callId, digit, driverId });
  res.json(result);
});

// Get active ringing calls
app.get('/api/ivr/calls', (req, res) => {
  res.json(ivrService.getActiveCalls());
});

server.listen(PORT, () => {
  console.log(`🚕 NexRide Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on port ${PORT}`);
});

module.exports = { app, server };
