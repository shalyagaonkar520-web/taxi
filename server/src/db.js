const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'nexride.db');
const sqlite = new Database(DB_PATH);

// Enable WAL mode for high concurrency and atomic writes
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

// Initialize schema
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'password123',
    phone TEXT,
    role TEXT NOT NULL,
    rating REAL DEFAULT 5.0,
    totalRides INTEGER DEFAULT 0,
    walletBalance REAL DEFAULT 100.0,
    avatar TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'DRIVER',
    rating REAL DEFAULT 4.95,
    totalTrips INTEGER DEFAULT 0,
    acceptanceRate INTEGER DEFAULT 98,
    status TEXT DEFAULT 'ONLINE',
    earningsToday REAL DEFAULT 0.0,
    walletBalance REAL DEFAULT 500.0,
    avatar TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    heading REAL DEFAULT 0,
    vehicle TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    riderId TEXT NOT NULL,
    driverId TEXT,
    pickup TEXT NOT NULL,
    destination TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    fare REAL NOT NULL,
    distanceKm REAL NOT NULL,
    durationMin REAL NOT NULL,
    otp TEXT NOT NULL,
    paymentMethod TEXT DEFAULT 'WALLET',
    rating INTEGER,
    tip REAL DEFAULT 0.0,
    routeCoordinates TEXT,
    driverRouteCoordinates TEXT,
    cancellationReason TEXT,
    createdAt TEXT NOT NULL,
    acceptedAt TEXT,
    startedAt TEXT,
    completedAt TEXT,
    cancelledAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (riderId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS driver_payouts (
    id TEXT PRIMARY KEY,
    driverId TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT DEFAULT 'INSTANT_BANK',
    status TEXT DEFAULT 'COMPLETED',
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS driver_kyc (
    driverId TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS driver_quests (
    driverId TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS driver_destination (
    driverId TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    destination TEXT
  );
`);

const INITIAL_USERS = [
  {
    id: 'rider-01',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    password: 'rider123',
    phone: '+1 (555) 234-5678',
    role: 'RIDER',
    rating: 4.92,
    totalRides: 48,
    walletBalance: 150.00,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'driver-user-01',
    name: 'Michael Rodriguez',
    email: 'michael.driver@example.com',
    password: 'driver123',
    phone: '+1 (555) 987-6543',
    role: 'DRIVER',
    rating: 4.96,
    totalRides: 1420,
    walletBalance: 840.00,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'driver-user-02',
    name: 'Sarah Chen',
    email: 'sarah.driver@example.com',
    password: 'driver123',
    phone: '+1 (555) 876-5432',
    role: 'DRIVER',
    rating: 4.89,
    totalRides: 890,
    walletBalance: 512.00,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'driver-user-03',
    name: 'David Kim',
    email: 'david.driver@example.com',
    password: 'driver123',
    phone: '+1 (555) 765-4321',
    role: 'DRIVER',
    rating: 4.94,
    totalRides: 2150,
    walletBalance: 1120.00,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'driver-user-04',
    name: 'Amina Yusuf',
    email: 'amina.driver@example.com',
    password: 'driver123',
    phone: '+1 (555) 654-3210',
    role: 'DRIVER',
    rating: 4.91,
    totalRides: 640,
    walletBalance: 320.00,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'admin-01',
    name: 'Dispatch Commander',
    email: 'admin@nexride.app',
    password: 'admin123',
    phone: '+1 (555) 000-0000',
    role: 'ADMIN',
    rating: 5.0,
    totalRides: 0,
    walletBalance: 25000.00,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString()
  }
];

const INITIAL_DRIVERS = [
  {
    id: 'driver-01',
    userId: 'driver-user-01',
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
    lat: 12.971891,
    lng: 77.593684,
    heading: 45,
    vehicle: {
      id: 'veh-01',
      make: 'Tesla',
      model: 'Model 3',
      year: 2023,
      color: 'Midnight Silver',
      licensePlate: 'KA-01-EQ-7892',
      category: 'UberBlack'
    }
  },
  {
    id: 'driver-02',
    userId: 'driver-user-02',
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
    lat: 12.977432,
    lng: 77.601243,
    heading: 180,
    vehicle: {
      id: 'veh-02',
      make: 'Toyota',
      model: 'Camry Hybrid',
      year: 2022,
      color: 'Pearl White',
      licensePlate: 'KA-03-MJ-4419',
      category: 'UberX'
    }
  },
  {
    id: 'driver-03',
    userId: 'driver-user-03',
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
    lat: 12.965412,
    lng: 77.588931,
    heading: 90,
    vehicle: {
      id: 'veh-03',
      make: 'Chevrolet',
      model: 'Suburban XL',
      year: 2023,
      color: 'Black Obsidian',
      licensePlate: 'KA-05-AB-9011',
      category: 'UberXL'
    }
  },
  {
    id: 'driver-04',
    userId: 'driver-user-04',
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
    lat: 12.981254,
    lng: 77.596812,
    heading: 270,
    vehicle: {
      id: 'veh-04',
      make: 'Honda',
      model: 'Accord Touring',
      year: 2023,
      color: 'Crystal Black',
      licensePlate: 'KA-04-TR-3321',
      category: 'UberComfort'
    }
  }
];

const INITIAL_SETTINGS = {
  surgeMultiplier: 1.0,
  platformCommissionPercent: 20,
  autoDispatchEnabled: true,
  currencySymbol: '$',
  city: 'Bengaluru / Metro Hub'
};

function formatDriver(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role || 'DRIVER',
    rating: row.rating,
    totalTrips: row.totalTrips,
    acceptanceRate: row.acceptanceRate,
    status: row.status,
    earningsToday: row.earningsToday,
    walletBalance: row.walletBalance,
    avatar: row.avatar,
    location: {
      lat: row.lat,
      lng: row.lng,
      heading: row.heading || 0
    },
    vehicle: typeof row.vehicle === 'string' ? JSON.parse(row.vehicle) : row.vehicle
  };
}

function formatRide(row) {
  if (!row) return null;
  return {
    id: row.id,
    riderId: row.riderId,
    driverId: row.driverId,
    pickup: typeof row.pickup === 'string' ? JSON.parse(row.pickup) : row.pickup,
    destination: typeof row.destination === 'string' ? JSON.parse(row.destination) : row.destination,
    category: row.category,
    status: row.status,
    fare: row.fare,
    distanceKm: row.distanceKm,
    durationMin: row.durationMin,
    otp: row.otp,
    paymentMethod: row.paymentMethod,
    rating: row.rating,
    tip: row.tip,
    routeCoordinates: row.routeCoordinates ? JSON.parse(row.routeCoordinates) : [],
    driverRouteCoordinates: row.driverRouteCoordinates ? JSON.parse(row.driverRouteCoordinates) : [],
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    updatedAt: row.updatedAt
  };
}

class SQLiteDatabase {
  constructor() {
    this.initSeedData();
  }

  initSeedData(force = false) {
    const userCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    if (userCount === 0 || force) {
      console.log('🌱 Seeding SQLite database with initial records...');
      const seedTransaction = sqlite.transaction(() => {
        if (force) {
          sqlite.prepare('DELETE FROM transactions').run();
          sqlite.prepare('DELETE FROM rides').run();
          sqlite.prepare('DELETE FROM drivers').run();
          sqlite.prepare('DELETE FROM users').run();
          sqlite.prepare('DELETE FROM settings').run();
        }

        const insertUser = sqlite.prepare(`
          INSERT INTO users (id, name, email, password, phone, role, rating, totalRides, walletBalance, avatar, createdAt)
          VALUES (@id, @name, @email, @password, @phone, @role, @rating, @totalRides, @walletBalance, @avatar, @createdAt)
        `);
        for (const user of INITIAL_USERS) {
          insertUser.run(user);
        }

        const insertDriver = sqlite.prepare(`
          INSERT INTO drivers (id, userId, name, email, phone, role, rating, totalTrips, acceptanceRate, status, earningsToday, walletBalance, avatar, lat, lng, heading, vehicle)
          VALUES (@id, @userId, @name, @email, @phone, @role, @rating, @totalTrips, @acceptanceRate, @status, @earningsToday, @walletBalance, @avatar, @lat, @lng, @heading, @vehicle)
        `);
        for (const driver of INITIAL_DRIVERS) {
          insertDriver.run({
            ...driver,
            vehicle: JSON.stringify(driver.vehicle)
          });
        }

        const insertSetting = sqlite.prepare(`
          INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)
        `);
        insertSetting.run(JSON.stringify(INITIAL_SETTINGS));

        // Sample completed ride
        const insertRide = sqlite.prepare(`
          INSERT INTO rides (id, riderId, driverId, pickup, destination, category, status, fare, distanceKm, durationMin, otp, paymentMethod, rating, tip, routeCoordinates, driverRouteCoordinates, createdAt, completedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertRide.run(
          'ride-sample-1',
          'rider-01',
          'driver-01',
          JSON.stringify({ address: 'MG Road Metro Station, Bengaluru', lat: 12.9756, lng: 77.6067 }),
          JSON.stringify({ address: 'Indiranagar 100ft Road, Bengaluru', lat: 12.9784, lng: 77.6408 }),
          'UberBlack',
          'COMPLETED',
          28.50,
          3.8,
          14,
          '4821',
          'WALLET',
          5,
          5.00,
          JSON.stringify([[12.9756, 77.6067], [12.9784, 77.6408]]),
          JSON.stringify([]),
          new Date(Date.now() - 3600000 * 2).toISOString(),
          new Date(Date.now() - 3600000 * 1.6).toISOString()
        );

        // Sample initial transactions
        const insertTx = sqlite.prepare(`
          INSERT INTO transactions (id, userId, amount, type, description, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertTx.run('tx-01', 'rider-01', -33.50, 'RIDE_PAYMENT', 'Ride to Indiranagar (Fare + Tip)', new Date(Date.now() - 3600000 * 1.6).toISOString());
        insertTx.run('tx-02', 'rider-01', 100.00, 'WALLET_TOPUP', 'Card Top-up (*4242)', new Date(Date.now() - 3600000 * 24).toISOString());
      });

      seedTransaction();
      console.log('✅ SQLite seeding complete.');
    }
  }

  // --- Users & Auth ---
  getUsers() {
    const rows = sqlite.prepare('SELECT id, name, email, phone, role, rating, totalRides, walletBalance, avatar, createdAt FROM users').all();
    return rows;
  }

  getUserById(id) {
    if (!id) return null;
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      // Also check if id belongs to driver table and fetch its driver profile
      const driver = this.getDriverById(id);
      if (driver) {
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          role: 'DRIVER',
          rating: driver.rating,
          totalRides: driver.totalTrips,
          walletBalance: driver.walletBalance,
          avatar: driver.avatar,
          status: driver.status
        };
      }
      return null;
    }
    const { password, ...safeUser } = user;
    return safeUser;
  }

  getUserByEmail(email) {
    if (!email) return null;
    return sqlite.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  }

  updateUser(id, updates) {
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return null;

    const fields = [];
    const values = [];

    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      sqlite.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return this.getUserById(id);
  }

  // --- Drivers ---
  getDrivers() {
    const rows = sqlite.prepare('SELECT * FROM drivers').all();
    return rows.map(formatDriver);
  }

  getDriverById(id) {
    if (!id) return null;
    const row = sqlite.prepare('SELECT * FROM drivers WHERE id = ? OR userId = ?').get(id, id);
    return formatDriver(row);
  }

  updateDriver(id, updates) {
    const current = this.getDriverById(id);
    if (!current) return null;

    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.earningsToday !== undefined) {
      fields.push('earningsToday = ?');
      values.push(updates.earningsToday);
    }
    if (updates.walletBalance !== undefined) {
      fields.push('walletBalance = ?');
      values.push(updates.walletBalance);
    }
    if (updates.totalTrips !== undefined) {
      fields.push('totalTrips = ?');
      values.push(updates.totalTrips);
    }
    if (updates.rating !== undefined) {
      fields.push('rating = ?');
      values.push(updates.rating);
    }
    if (updates.location !== undefined) {
      if (updates.location.lat !== undefined) {
        fields.push('lat = ?');
        values.push(updates.location.lat);
      }
      if (updates.location.lng !== undefined) {
        fields.push('lng = ?');
        values.push(updates.location.lng);
      }
      if (updates.location.heading !== undefined) {
        fields.push('heading = ?');
        values.push(updates.location.heading);
      }
    }
    if (updates.vehicle !== undefined) {
      fields.push('vehicle = ?');
      values.push(typeof updates.vehicle === 'string' ? updates.vehicle : JSON.stringify(updates.vehicle));
    }

    if (fields.length > 0) {
      values.push(current.id);
      sqlite.prepare(`UPDATE drivers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getDriverById(current.id);
  }

  // --- Rides ---
  getRides() {
    const rows = sqlite.prepare('SELECT * FROM rides ORDER BY createdAt DESC').all();
    return rows.map(formatRide);
  }

  getRideById(id) {
    if (!id) return null;
    const row = sqlite.prepare('SELECT * FROM rides WHERE id = ?').get(id);
    return formatRide(row);
  }

  getActiveRideForUser(userId) {
    if (!userId) return null;
    // Check if user is rider or driver
    const driver = this.getDriverById(userId);
    const driverId = driver ? driver.id : userId;

    const row = sqlite.prepare(`
      SELECT * FROM rides 
      WHERE (riderId = ? OR driverId = ? OR driverId = ?) 
        AND status IN ('REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS')
      ORDER BY createdAt DESC LIMIT 1
    `).get(userId, userId, driverId);

    return formatRide(row);
  }

  createRide(rideData) {
    const id = `ride-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const stmt = sqlite.prepare(`
      INSERT INTO rides (
        id, riderId, driverId, pickup, destination, category, status, fare,
        distanceKm, durationMin, otp, paymentMethod, rating, tip,
        routeCoordinates, driverRouteCoordinates, createdAt, updatedAt
      ) VALUES (
        @id, @riderId, @driverId, @pickup, @destination, @category, @status, @fare,
        @distanceKm, @durationMin, @otp, @paymentMethod, @rating, @tip,
        @routeCoordinates, @driverRouteCoordinates, @createdAt, @updatedAt
      )
    `);

    stmt.run({
      id,
      riderId: rideData.riderId,
      driverId: rideData.driverId || null,
      pickup: JSON.stringify(rideData.pickup),
      destination: JSON.stringify(rideData.destination),
      category: rideData.category,
      status: rideData.status || 'REQUESTED',
      fare: rideData.fare,
      distanceKm: rideData.distanceKm,
      durationMin: rideData.durationMin,
      otp,
      paymentMethod: rideData.paymentMethod || 'WALLET',
      rating: null,
      tip: 0,
      routeCoordinates: JSON.stringify(rideData.routeCoordinates || []),
      driverRouteCoordinates: JSON.stringify(rideData.driverRouteCoordinates || []),
      createdAt: now,
      updatedAt: now
    });

    return this.getRideById(id);
  }

  updateRide(id, updates) {
    const current = this.getRideById(id);
    if (!current) return null;

    const fields = [];
    const values = [];

    const fieldMap = {
      status: val => val,
      driverId: val => val,
      rating: val => val,
      tip: val => val,
      cancellationReason: val => val,
      acceptedAt: val => val,
      startedAt: val => val,
      completedAt: val => val,
      cancelledAt: val => val,
      pickup: val => JSON.stringify(val),
      destination: val => JSON.stringify(val),
      routeCoordinates: val => JSON.stringify(val),
      driverRouteCoordinates: val => JSON.stringify(val)
    };

    for (const [key, val] of Object.entries(updates)) {
      if (fieldMap[key]) {
        fields.push(`${key} = ?`);
        values.push(fieldMap[key](val));
      }
    }

    fields.push('updatedAt = ?');
    values.push(new Date().toISOString());

    values.push(id);
    sqlite.prepare(`UPDATE rides SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.getRideById(id);
  }

  // --- Transactions & Wallet ---
  addTransaction(tx) {
    const id = `tx-${uuidv4().substring(0, 8)}`;
    const timestamp = tx.timestamp || new Date().toISOString();

    const atomicTx = sqlite.transaction(() => {
      sqlite.prepare(`
        INSERT INTO transactions (id, userId, amount, type, description, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, tx.userId, tx.amount, tx.type, tx.description, timestamp);

      // Also adjust user/driver wallet balance atomically if user exists
      const user = sqlite.prepare('SELECT id, walletBalance FROM users WHERE id = ?').get(tx.userId);
      if (user) {
        const newBalance = Math.max(0, Number((user.walletBalance + tx.amount).toFixed(2)));
        sqlite.prepare('UPDATE users SET walletBalance = ? WHERE id = ?').run(newBalance, tx.userId);
      }
    });

    atomicTx();

    return {
      id,
      userId: tx.userId,
      amount: tx.amount,
      type: tx.type,
      description: tx.description,
      timestamp
    };
  }

  getUserTransactions(userId) {
    if (!userId) return [];
    return sqlite.prepare('SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC').all(userId);
  }

  // --- Settings ---
  getSettings() {
    const row = sqlite.prepare('SELECT data FROM settings WHERE id = 1').get();
    if (!row) return INITIAL_SETTINGS;
    return JSON.parse(row.data);
  }

  updateSettings(updates) {
    const current = this.getSettings();
    const merged = { ...current, ...updates };
    sqlite.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(JSON.stringify(merged));
    return merged;
  }

  // --- DRIVER EXTENSIONS ---

  resolveDriver(id) {
    if (!id) return this.getDrivers()[0] || null;
    let driver = this.getDriverById(id);
    if (!driver) {
      driver = this.getDrivers().find(d => d.userId === id || d.email === id);
    }
    if (!driver) {
      driver = this.getDrivers()[0];
    }
    return driver;
  }

  getDriverSummary(driverId) {
    const driver = this.resolveDriver(driverId);
    if (!driver) return null;

    const todayRides = this.getRides().filter(
      r => r.driverId === driver.id && r.status === 'COMPLETED'
    );

    const todayEarnings = Number((todayRides.reduce((sum, r) => sum + (r.fare * 0.8) + (r.tip || 0), 0) + (driver.earningsToday || 184.20)).toFixed(2));
    const completedTrips = (driver.totalTrips || 1420) + todayRides.length;

    return {
      driverId: driver.id,
      name: driver.name,
      rating: driver.rating || 4.96,
      status: driver.status || 'ONLINE',
      approvalStatus: 'APPROVED',
      acceptanceRate: driver.acceptanceRate || 98,
      cancellationRate: 2,
      today: {
        earnings: todayEarnings,
        trips: todayRides.length > 0 ? todayRides.length : 8,
        onlineHours: 5.4,
        acceptanceRate: driver.acceptanceRate || 98,
        sessionSeconds: 19440
      },
      walletBalance: driver.walletBalance || 840.0,
      vehicle: driver.vehicle
    };
  }

  getDriverEarnings(driverId, range = 'week') {
    const driver = this.resolveDriver(driverId);
    const summary = this.getDriverSummary(driverId);

    const weekChart = [
      { day: 'Mon', amount: 145.50, trips: 7 },
      { day: 'Tue', amount: 182.00, trips: 9 },
      { day: 'Wed', amount: 138.25, trips: 6 },
      { day: 'Thu', amount: 210.00, trips: 10 },
      { day: 'Fri', amount: 265.80, trips: 12 },
      { day: 'Sat', amount: 310.50, trips: 14 },
      { day: 'Sun', amount: summary.today.earnings, trips: summary.today.trips }
    ];

    const dayChart = [
      { time: '06:00', amount: 22.50 },
      { time: '08:00', amount: 48.00 },
      { time: '10:00', amount: 35.20 },
      { time: '12:00', amount: 18.50 },
      { time: '14:00', amount: 29.00 },
      { time: '16:00', amount: 42.00 },
      { time: '18:00', amount: 55.40 },
      { time: '20:00', amount: 38.00 }
    ];

    // Get payouts
    const payouts = sqlite.prepare('SELECT * FROM driver_payouts WHERE driverId = ? ORDER BY timestamp DESC LIMIT 10').all(driver.id);
    if (payouts.length === 0) {
      payouts.push(
        { id: 'pay-01', driverId: driver.id, amount: 450.00, method: 'INSTANT_BANK', status: 'COMPLETED', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 'pay-02', driverId: driver.id, amount: 620.00, method: 'UPI_FAST', status: 'COMPLETED', timestamp: new Date(Date.now() - 86400000 * 5).toISOString() }
      );
    }

    const mockTrips = [
      {
        id: 'trip-901',
        fare: 28.50,
        surgeBonus: 5.70,
        tip: 4.00,
        commission: 5.70,
        net: 32.50,
        paymentMethod: 'ONLINE',
        pickup: 'MG Road Metro Station',
        destination: 'Indiranagar 100ft Road',
        distanceKm: 4.8,
        durationMin: 18,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'trip-902',
        fare: 44.00,
        surgeBonus: 8.80,
        tip: 5.00,
        commission: 8.80,
        net: 49.00,
        paymentMethod: 'CASH',
        pickup: 'Koramangala 5th Block',
        destination: 'Whitefield ITPL Gate 2',
        distanceKm: 14.2,
        durationMin: 42,
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        id: 'trip-903',
        fare: 18.00,
        surgeBonus: 0.00,
        tip: 2.00,
        commission: 3.60,
        net: 16.40,
        paymentMethod: 'ONLINE',
        pickup: 'UB City Mall',
        destination: 'Richmond Town',
        distanceKm: 2.5,
        durationMin: 12,
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
      }
    ];

    const completedDbRides = this.getRides().filter(r => r.driverId === driver.id && r.status === 'COMPLETED');
    const allTrips = [...completedDbRides.map(r => ({
      id: r.id,
      fare: r.fare,
      surgeBonus: Number((r.fare * 0.15).toFixed(2)),
      tip: r.tip || 0,
      commission: Number((r.fare * 0.20).toFixed(2)),
      net: Number(((r.fare * 0.8) + (r.tip || 0)).toFixed(2)),
      paymentMethod: r.paymentMethod || 'ONLINE',
      pickup: r.pickup?.address || 'Pickup Point',
      destination: r.destination?.address || 'Destination Point',
      distanceKm: r.distanceKm || 5.0,
      durationMin: r.durationMin || 20,
      createdAt: r.completedAt || r.createdAt
    })), ...mockTrips];

    const totalGross = allTrips.reduce((s, t) => s + t.fare, 0);
    const totalNet = allTrips.reduce((s, t) => s + t.net, 0);
    const cashEarnings = allTrips.filter(t => t.paymentMethod === 'CASH').reduce((s, t) => s + t.net, 0);
    const onlineEarnings = allTrips.filter(t => t.paymentMethod !== 'CASH').reduce((s, t) => s + t.net, 0);

    return {
      range,
      driverId: driver.id,
      summary: {
        totalNet: Number(totalNet.toFixed(2)),
        totalGross: Number(totalGross.toFixed(2)),
        cashEarnings: Number(cashEarnings.toFixed(2)),
        onlineEarnings: Number(onlineEarnings.toFixed(2)),
        walletBalance: driver.walletBalance,
        tripsCount: allTrips.length
      },
      chartData: range === 'day' ? dayChart : weekChart,
      trips: allTrips,
      payouts
    };
  }

  recordCashout(driverId, amount, method = 'INSTANT_BANK') {
    const driver = this.resolveDriver(driverId);
    if (!driver) throw new Error('Driver not found');
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) throw new Error('Invalid cashout amount');
    if (driver.walletBalance < numAmount) throw new Error('Insufficient wallet balance');

    const payoutId = `pay-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const atomic = sqlite.transaction(() => {
      const newBal = Number((driver.walletBalance - numAmount).toFixed(2));
      sqlite.prepare('UPDATE drivers SET walletBalance = ? WHERE id = ?').run(newBal, driver.id);
      if (driver.userId) {
        sqlite.prepare('UPDATE users SET walletBalance = ? WHERE id = ?').run(newBal, driver.userId);
      }
      sqlite.prepare(`
        INSERT INTO driver_payouts (id, driverId, amount, method, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(payoutId, driver.id, numAmount, method, 'COMPLETED', now);

      sqlite.prepare(`
        INSERT INTO transactions (id, userId, amount, type, description, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`tx-${uuidv4().substring(0, 8)}`, driver.userId || driver.id, -numAmount, 'DEBIT', `Instant Cash-Out via ${method}`, now);
    });

    atomic();

    return {
      success: true,
      payoutId,
      amount: numAmount,
      method,
      status: 'COMPLETED',
      remainingBalance: Number((driver.walletBalance - numAmount).toFixed(2)),
      timestamp: now
    };
  }

  getDriverHeatmap() {
    return [
      {
        id: 'surge-mg-road',
        name: 'Downtown Commercial Hub',
        lat: 12.9750,
        lng: 77.6090,
        radius: 1300,
        surgeMultiplier: 2.2,
        demandLevel: 'SURGE',
        color: '#EF4444',
        ridesPending: 18,
        description: '+2.2x Surge pricing active due to high evening transit demand'
      },
      {
        id: 'surge-indiranagar',
        name: 'Indiranagar 100ft Corridor',
        lat: 12.9784,
        lng: 77.6408,
        radius: 1100,
        surgeMultiplier: 1.8,
        demandLevel: 'VERY_HIGH',
        color: '#F97316',
        ridesPending: 12,
        description: '+1.8x High dinner & social transit requests'
      },
      {
        id: 'surge-koramangala',
        name: 'Koramangala Tech District',
        lat: 12.9352,
        lng: 77.6245,
        radius: 1200,
        surgeMultiplier: 1.6,
        demandLevel: 'HIGH',
        color: '#EAB308',
        ridesPending: 9,
        description: '+1.6x Startups & residential zone'
      },
      {
        id: 'surge-whitefield',
        name: 'Whitefield Tech Park Gate',
        lat: 12.9698,
        lng: 77.7500,
        radius: 1500,
        surgeMultiplier: 1.5,
        demandLevel: 'HIGH',
        color: '#3B82F6',
        ridesPending: 14,
        description: '+1.5x IT campus shift departures'
      },
      {
        id: 'surge-airport',
        name: 'Airport Express Highway',
        lat: 13.0358,
        lng: 77.5970,
        radius: 1600,
        surgeMultiplier: 2.5,
        demandLevel: 'SURGE',
        color: '#DC2626',
        ridesPending: 22,
        description: '+2.5x Airport outbound flights cluster'
      }
    ];
  }

  getDriverQuests(driverId) {
    const driver = this.resolveDriver(driverId);
    const row = sqlite.prepare('SELECT data FROM driver_quests WHERE driverId = ?').get(driver.id);
    if (row) {
      return JSON.parse(row.data);
    }

    const initialQuests = {
      driverId: driver.id,
      streakDays: 6,
      referralCode: `NEX-${driver.name.split(' ')[0].toUpperCase()}77`,
      referralEarnings: 300,
      referralsCount: 3,
      peakHourBonuses: [
        { time: '08:00 - 11:00 AM', label: 'Morning Rush', bonus: '+$5.00 / trip', status: 'COMPLETED' },
        { time: '05:00 - 09:00 PM', label: 'Evening Peak', bonus: '+$7.50 / trip', status: 'ACTIVE' },
        { time: '11:00 PM - 03:00 AM', label: 'Night Owl Extra', bonus: '+$10.00 / trip', status: 'UPCOMING' }
      ],
      quests: [
        {
          id: 'quest-daily-10',
          title: 'Daily Hero Sprint',
          description: 'Complete 10 rides today between 06:00 - 23:59',
          reward: 35.00,
          current: 7,
          target: 10,
          unit: 'rides',
          expiresIn: '4h 12m',
          completed: false,
          claimed: false
        },
        {
          id: 'quest-peak-5',
          title: 'Peak-Hour Master',
          description: 'Complete 5 trips during 5:00 PM - 9:00 PM peak hours',
          reward: 25.00,
          current: 5,
          target: 5,
          unit: 'rides',
          expiresIn: '2h 45m',
          completed: true,
          claimed: false
        },
        {
          id: 'quest-weekend-25',
          title: 'Weekend Warrior',
          description: 'Complete 25 rides over Friday through Sunday',
          reward: 80.00,
          current: 19,
          target: 25,
          unit: 'rides',
          expiresIn: '1d 6h',
          completed: false,
          claimed: false
        }
      ]
    };

    sqlite.prepare('INSERT OR REPLACE INTO driver_quests (driverId, data) VALUES (?, ?)').run(driver.id, JSON.stringify(initialQuests));
    return initialQuests;
  }

  claimQuest(driverId, questId) {
    const data = this.getDriverQuests(driverId);
    const quest = data.quests.find(q => q.id === questId);
    if (!quest) throw new Error('Quest not found');
    if (!quest.completed) throw new Error('Quest target not yet reached');
    if (quest.claimed) throw new Error('Quest reward already claimed');

    quest.claimed = true;
    sqlite.prepare('INSERT OR REPLACE INTO driver_quests (driverId, data) VALUES (?, ?)').run(data.driverId, JSON.stringify(data));

    // Award bonus to driver balance
    const driver = this.resolveDriver(driverId);
    const newBal = Number((driver.walletBalance + quest.reward).toFixed(2));
    sqlite.prepare('UPDATE drivers SET walletBalance = ? WHERE id = ?').run(newBal, driver.id);
    if (driver.userId) {
      sqlite.prepare('UPDATE users SET walletBalance = ? WHERE id = ?').run(newBal, driver.userId);
    }

    return { success: true, reward: quest.reward, newBalance: newBal, quest };
  }

  getDriverKyc(driverId) {
    const driver = this.resolveDriver(driverId);
    const row = sqlite.prepare('SELECT data FROM driver_kyc WHERE driverId = ?').get(driver.id);
    if (row) {
      return JSON.parse(row.data);
    }

    const initialKyc = {
      driverId: driver.id,
      overallStatus: 'VERIFIED',
      documents: {
        license: {
          title: 'Commercial Driving License',
          docNumber: 'DL-042023008912',
          status: 'VERIFIED',
          expiryDate: '2028-11-15',
          daysUntilExpiry: 786,
          isExpiringSoon: false,
          fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'
        },
        rc: {
          title: 'Vehicle Registration Certificate (RC)',
          docNumber: driver.vehicle?.licensePlate || 'KA-01-EQ-7892',
          status: 'VERIFIED',
          expiryDate: '2027-08-30',
          daysUntilExpiry: 345,
          isExpiringSoon: false,
          fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400'
        },
        insurance: {
          title: 'Commercial Ride-Hailing Insurance',
          docNumber: 'POL-COMM-998231',
          status: 'VERIFIED',
          expiryDate: '2026-10-25',
          daysUntilExpiry: 36,
          isExpiringSoon: true,
          fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400'
        }
      },
      payoutDetails: {
        bankName: 'Silicon City National Bank',
        accountNumber: '••••••••4892',
        routingNumber: '021000021',
        upiId: `${driver.email.split('@')[0]}@okhdfcbank`,
        preferredMethod: 'INSTANT_BANK'
      }
    };

    sqlite.prepare('INSERT OR REPLACE INTO driver_kyc (driverId, data) VALUES (?, ?)').run(driver.id, JSON.stringify(initialKyc));
    return initialKyc;
  }

  updateDriverKyc(driverId, docType, fileData) {
    const kyc = this.getDriverKyc(driverId);
    if (kyc.documents[docType]) {
      kyc.documents[docType] = {
        ...kyc.documents[docType],
        ...fileData,
        status: 'VERIFIED',
        updatedAt: new Date().toISOString()
      };
      sqlite.prepare('INSERT OR REPLACE INTO driver_kyc (driverId, data) VALUES (?, ?)').run(kyc.driverId, JSON.stringify(kyc));
    }
    return kyc;
  }

  getDriverDestination(driverId) {
    const driver = this.resolveDriver(driverId);
    const row = sqlite.prepare('SELECT * FROM driver_destination WHERE driverId = ?').get(driver.id);
    if (!row) {
      return { enabled: false, destination: null };
    }
    return { enabled: Boolean(row.enabled), destination: row.destination ? JSON.parse(row.destination) : null };
  }

  setDriverDestination(driverId, { enabled, destination }) {
    const driver = this.resolveDriver(driverId);
    sqlite.prepare(`
      INSERT OR REPLACE INTO driver_destination (driverId, enabled, destination)
      VALUES (?, ?, ?)
    `).run(driver.id, enabled ? 1 : 0, destination ? JSON.stringify(destination) : null);
    return { enabled: Boolean(enabled), destination };
  }
}

module.exports = new SQLiteDatabase();
