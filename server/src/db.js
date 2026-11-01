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
    currencyCode: 'USD',
    currencyLocale: 'en-US',
    city: 'New York, NY'
  }
};

const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', locale: 'en-US' },
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€', locale: 'fr-FR' },
  CAD: { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
  AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU' }
};

class Database {
  constructor() {
    this.data = this.loadData();
    this.pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
    if (this.pool) {
      // Idle client errors would otherwise be an unhandled 'error' event and crash the process.
      this.pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));
    }
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
    if (typeof password !== 'string' || !storedHash || !storedHash.includes(':')) return false;
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
      if (user.role === 'DRIVER') {
        if (!user.passwordHash) {
          user.passwordHash = this.hashPassword('driver123');
          changed = true;
        }
        if (!user.location || typeof user.location.lat !== 'number' || typeof user.location.lng !== 'number') {
          user.location = {
            lat: 40.758896 + (Math.random() - 0.5) * 0.02,
            lng: -73.985130 + (Math.random() - 0.5) * 0.02,
            heading: Math.floor(Math.random() * 360)
          };
          changed = true;
        }
        if (!user.vehicle) {
          user.vehicle = {
            id: `veh-${user.id}`,
            make: 'Toyota',
            model: 'Camry Hybrid',
            year: 2023,
            color: 'Midnight Black',
            licensePlate: 'NYC-5520',
            category: 'UberX'
          };
          changed = true;
        }
      }
    });
    if (changed) this.saveData();
  }

  authenticateUser(email, password, role) {
    const user = this.data.users.find((candidate) =>
      String(candidate.email || '').toLowerCase() === String(email).toLowerCase() &&
      candidate.role === role &&
      this.verifyPassword(password, candidate.passwordHash)
    );
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  changePassword(id, currentPassword, newPassword) {
    const user = this.getUserById(id);
    if (!user || !this.verifyPassword(currentPassword, user.passwordHash)) return null;
    user.passwordHash = this.hashPassword(newPassword);
    this.saveData();
    return this.sanitizeUser(user);
  }

  upsertFirebaseUser(firebaseUser, role) {
    let user = this.data.users.find(candidate =>
      candidate.firebaseUid === firebaseUser.uid ||
      String(candidate.email || '').toLowerCase() === firebaseUser.email.toLowerCase()
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
        ...(role === 'DRIVER' ? {
          status: 'OFFLINE',
          totalTrips: 0,
          acceptanceRate: 100,
          location: {
            lat: 40.758896 + (Math.random() - 0.5) * 0.02,
            lng: -73.985130 + (Math.random() - 0.5) * 0.02,
            heading: Math.floor(Math.random() * 360)
          },
          vehicle: {
            id: `veh-${firebaseUser.uid.substring(0, 6)}`,
            make: 'Toyota',
            model: 'Camry Hybrid',
            year: 2023,
            color: 'Midnight Black',
            licensePlate: 'NYC-5520',
            category: 'UberX'
          }
        } : { totalRides: 0 })
      };
      this.data.users.push(user);
    } else {
      Object.assign(user, {
        firebaseUid: firebaseUser.uid,
        name: firebaseUser.name || user.name,
        avatar: firebaseUser.picture || user.avatar
      });
      if (role === 'DRIVER' && (!user.location || typeof user.location.lat !== 'number' || typeof user.location.lng !== 'number')) {
        user.location = {
          lat: 40.758896 + (Math.random() - 0.5) * 0.02,
          lng: -73.985130 + (Math.random() - 0.5) * 0.02,
          heading: Math.floor(Math.random() * 360)
        };
      }
      if (role === 'DRIVER' && !user.vehicle) {
        user.vehicle = {
          id: `veh-${user.id}`,
          make: 'Toyota',
          model: 'Camry Hybrid',
          year: 2023,
          color: 'Midnight Black',
          licensePlate: 'NYC-5520',
          category: 'UberX'
        };
      }
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

  // Pass { persist: false } for high-frequency updates (GPS ticks) that should not hit storage every time.
  updateDriver(id, updates, { persist = true } = {}) {
    const driver = this.getDriverById(id);
    if (!driver) return null;
    Object.assign(driver, updates);
    if (persist) this.saveData();
    return driver;
  }

  isEmailTaken(email, exceptUserId) {
    const normalized = String(email || '').toLowerCase();
    return this.data.users.some((user) =>
      user.id !== exceptUserId && String(user.email || '').toLowerCase() === normalized
    );
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

  updateSettings(updates = {}) {
    const settings = this.data.settings;
    const next = {};

    if (updates.surgeMultiplier !== undefined) {
      const surge = Number(updates.surgeMultiplier);
      if (!Number.isFinite(surge) || surge < 1 || surge > 10) {
        throw new Error('surgeMultiplier must be a number between 1 and 10');
      }
      next.surgeMultiplier = Number(surge.toFixed(2));
    }

    if (updates.platformCommissionPercent !== undefined) {
      const commission = Number(updates.platformCommissionPercent);
      if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
        throw new Error('platformCommissionPercent must be a number between 0 and 100');
      }
      next.platformCommissionPercent = commission;
    }

    if (updates.autoDispatchEnabled !== undefined) {
      next.autoDispatchEnabled = Boolean(updates.autoDispatchEnabled);
    }

    if (updates.city !== undefined) {
      const city = String(updates.city).trim().slice(0, 120);
      if (city) next.city = city;
    }

    if (updates.currencyCode !== undefined) {
      const code = String(updates.currencyCode).toUpperCase();
      const currency = SUPPORTED_CURRENCIES[code];
      if (!currency) throw new Error('Unsupported currencyCode');
      next.currencyCode = currency.code;
      next.currencySymbol = currency.symbol;
      next.currencyLocale = currency.locale;
    }

    Object.assign(settings, next);
    this.saveData();
    return settings;
  }
}

module.exports = new Database();
