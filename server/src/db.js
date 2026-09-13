const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial realistic seed dataset
const INITIAL_DATA = {
  users: [
    {
      id: 'rider-01',
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '+1 (555) 234-5678',
      role: 'RIDER',
      rating: 4.92,
      totalRides: 48,
      walletBalance: 125.50,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'driver-01',
      name: 'Michael Rodriguez',
      email: 'michael.driver@example.com',
      phone: '+1 (555) 987-6543',
      role: 'DRIVER',
      rating: 4.96,
      totalTrips: 1420,
      acceptanceRate: 98,
      status: 'ONLINE',
      earningsToday: 184.20,
      walletBalance: 840.00,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      location: {
        lat: 40.748817,
        lng: -73.985428,
        heading: 45
      },
      vehicle: {
        id: 'veh-01',
        make: 'Tesla',
        model: 'Model 3',
        year: 2023,
        color: 'Midnight Silver',
        licensePlate: 'NYC-7892',
        category: 'UberBlack'
      }
    },
    {
      id: 'driver-02',
      name: 'Sarah Chen',
      email: 'sarah.driver@example.com',
      phone: '+1 (555) 876-5432',
      role: 'DRIVER',
      rating: 4.89,
      totalTrips: 890,
      acceptanceRate: 95,
      status: 'ONLINE',
      earningsToday: 142.50,
      walletBalance: 512.00,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      location: {
        lat: 40.758896,
        lng: -73.985130,
        heading: 180
      },
      vehicle: {
        id: 'veh-02',
        make: 'Toyota',
        model: 'Camry Hybrid',
        year: 2022,
        color: 'Pearl White',
        licensePlate: 'NYC-4419',
        category: 'UberX'
      }
    },
    {
      id: 'driver-03',
      name: 'David Kim',
      email: 'david.driver@example.com',
      phone: '+1 (555) 765-4321',
      role: 'DRIVER',
      rating: 4.94,
      totalTrips: 2150,
      acceptanceRate: 99,
      status: 'ONLINE',
      earningsToday: 230.00,
      walletBalance: 1120.00,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      location: {
        lat: 40.741895,
        lng: -73.989308,
        heading: 90
      },
      vehicle: {
        id: 'veh-03',
        make: 'Chevrolet',
        model: 'Suburban XL',
        year: 2023,
        color: 'Black Obsidian',
        licensePlate: 'NYC-9011',
        category: 'UberXL'
      }
    },
    {
      id: 'driver-04',
      name: 'Amina Yusuf',
      email: 'amina.driver@example.com',
      phone: '+1 (555) 654-3210',
      role: 'DRIVER',
      rating: 4.91,
      totalTrips: 640,
      acceptanceRate: 96,
      status: 'ONLINE',
      earningsToday: 95.00,
      walletBalance: 320.00,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      location: {
        lat: 40.752726,
        lng: -73.977229,
        heading: 270
      },
      vehicle: {
        id: 'veh-04',
        make: 'Honda',
        model: 'Accord Touring',
        year: 2023,
        color: 'Crystal Black',
        licensePlate: 'NYC-3321',
        category: 'UberComfort'
      }
    },
    {
      id: 'admin-01',
      name: 'Dispatch Central',
      email: 'admin@nexride.com',
      role: 'ADMIN',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
    }
  ],
  rides: [
    {
      id: 'ride-sample-1',
      riderId: 'rider-01',
      driverId: 'driver-01',
      pickup: {
        address: 'Empire State Building, 20 W 34th St, New York',
        lat: 40.748817,
        lng: -73.985428
      },
      destination: {
        address: 'Times Square, Manhattan, New York',
        lat: 40.758896,
        lng: -73.985130
      },
      category: 'UberBlack',
      status: 'COMPLETED',
      fare: 28.50,
      distanceKm: 1.8,
      durationMin: 9,
      otp: '4821',
      paymentMethod: 'WALLET',
      rating: 5,
      tip: 5.00,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 1.8).toISOString()
    }
  ],
  transactions: [
    {
      id: 'tx-01',
      userId: 'rider-01',
      amount: -33.50,
      type: 'RIDE_PAYMENT',
      description: 'Ride to Times Square (Fare + Tip)',
      timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString()
    },
    {
      id: 'tx-02',
      userId: 'rider-01',
      amount: 100.00,
      type: 'WALLET_TOPUP',
      description: 'Card Top-up (*4242)',
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
    }
  ],
  settings: {
    surgeMultiplier: 1.0,
    platformCommissionPercent: 20,
    autoDispatchEnabled: true,
    currencySymbol: '$',
    city: 'New York, NY'
  }
};

class Database {
  constructor() {
    this.data = this.loadData();
    this.pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
    this.pendingWrite = Promise.resolve();
    this.ensureUserCredentials();
  }

  async initialize() {
    if (!this.pool) {
      console.warn('DATABASE_URL is not configured; using local JSON storage.');
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS nexride_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await this.pool.query('SELECT data FROM nexride_state WHERE id = 1');
    if (result.rows.length === 0) {
      await this.pool.query(
        'INSERT INTO nexride_state (id, data) VALUES (1, $1::jsonb)',
        [JSON.stringify(this.data)]
      );
      return;
    }

    this.data = result.rows[0].data;
    this.ensureUserCredentials();
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, key] = storedHash.split(':');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedKey = Buffer.from(key, 'hex');
    return storedKey.length === derivedKey.length && crypto.timingSafeEqual(storedKey, derivedKey);
  }

  sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  ensureUserCredentials() {
    let changed = false;
    this.data.users.forEach((user) => {
      if (user.role === 'RIDER' && !user.passwordHash) {
        user.passwordHash = this.hashPassword('rider123');
        changed = true;
      }
      if (user.role === 'DRIVER' && !user.passwordHash) {
        user.passwordHash = this.hashPassword('driver123');
        changed = true;
      }
    });
    if (changed) this.saveData();
  }

  authenticateUser(email, password, role) {
    const user = this.data.users.find((candidate) =>
      candidate.email.toLowerCase() === String(email).toLowerCase() &&
      candidate.role === role &&
      this.verifyPassword(password, candidate.passwordHash)
    );
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  upsertFirebaseUser(firebaseUser, role) {
    let user = this.data.users.find(candidate =>
      candidate.firebaseUid === firebaseUser.uid ||
      candidate.email.toLowerCase() === firebaseUser.email.toLowerCase()
    );

    if (user && user.role !== role) return null;
    if (!user) {
      user = {
        id: `firebase-${firebaseUser.uid}`,
        firebaseUid: firebaseUser.uid,
        name: firebaseUser.name || firebaseUser.email.split('@')[0],
        email: firebaseUser.email,
        role,
        rating: 5,
        walletBalance: 0,
        avatar: firebaseUser.picture || null,
        ...(role === 'DRIVER' ? { status: 'OFFLINE', totalTrips: 0, acceptanceRate: 100 } : { totalRides: 0 })
      };
      this.data.users.push(user);
    } else {
      Object.assign(user, {
        firebaseUid: firebaseUser.uid,
        name: firebaseUser.name || user.name,
        avatar: firebaseUser.picture || user.avatar
      });
    }

    this.saveData();
    return this.sanitizeUser(user);
  }

  loadData() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading db.json, re-initializing seed data:', err.message);
    }
    this.saveData(INITIAL_DATA);
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  saveData(data) {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      const nextData = data || this.data;
      if (this.pool) {
        this.pendingWrite = this.pendingWrite
          .then(() => this.pool.query(
            'INSERT INTO nexride_state (id, data, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()',
            [JSON.stringify(nextData)]
          ))
          .catch((err) => console.error('Failed to write PostgreSQL state:', err.message));
        return;
      }

      fs.writeFileSync(tempPath, JSON.stringify(nextData, null, 2), 'utf8');
      try {
        fs.renameSync(tempPath, DB_FILE);
      } catch (err) {
        if (err.code !== 'EPERM' && err.code !== 'EEXIST') throw err;
        fs.copyFileSync(tempPath, DB_FILE);
        fs.rmSync(tempPath, { force: true });
      }
    } catch (err) {
      console.error('Failed to write db.json:', err.message);
    }
  }

  // Users & Drivers
  getUsers() {
    return this.data.users.map(user => this.sanitizeUser(user));
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  getDrivers() {
    return this.data.users
      .filter(u => u.role === 'DRIVER')
      .map(user => this.sanitizeUser(user));
  }

  getDriverById(id) {
    return this.data.users.find(u => u.id === id && u.role === 'DRIVER');
  }

  updateDriver(id, updates) {
    const driver = this.getDriverById(id);
    if (!driver) return null;
    Object.assign(driver, updates);
    this.saveData();
    return driver;
  }

  updateUser(id, updates) {
    const user = this.getUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.saveData();
    return user;
  }

  // Rides
  getRides() {
    return this.data.rides;
  }

  getRideById(id) {
    return this.data.rides.find(r => r.id === id);
  }

  getActiveRideForUser(userId) {
    return this.data.rides.find(r => 
      (r.riderId === userId || r.driverId === userId) && 
      ['REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)
    );
  }

  createRide(rideData) {
    const ride = {
      id: `ride-${uuidv4().substring(0, 8)}`,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      otp: Math.floor(1000 + Math.random() * 9000).toString(),
      ...rideData
    };
    this.data.rides.unshift(ride);
    this.saveData();
    return ride;
  }

  updateRide(id, updates) {
    const ride = this.getRideById(id);
    if (!ride) return null;
    Object.assign(ride, updates, { updatedAt: new Date().toISOString() });
    this.saveData();
    return ride;
  }

  // Wallet & Transactions
  addTransaction(tx) {
    const newTx = {
      id: `tx-${uuidv4().substring(0, 8)}`,
      timestamp: new Date().toISOString(),
      ...tx
    };
    this.data.transactions.unshift(newTx);
    this.saveData();
    return newTx;
  }

  getUserTransactions(userId) {
    return this.data.transactions.filter(t => t.userId === userId);
  }

  // Settings
  getSettings() {
    return this.data.settings;
  }

  updateSettings(updates) {
    Object.assign(this.data.settings, updates);
    this.saveData();
    return this.data.settings;
  }
}

module.exports = new Database();
