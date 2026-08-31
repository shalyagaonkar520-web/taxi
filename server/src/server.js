const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db');
const { getFareQuotes, calculateFare, VEHICLE_TIERS } = require('./services/pricing');
const { getDrivingRoute, searchPlaces } = require('./services/routing');
const { setupSocketIO } = require('./socket');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

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

server.listen(PORT, () => {
  console.log(`🚕 NexRide Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on port ${PORT}`);
});
