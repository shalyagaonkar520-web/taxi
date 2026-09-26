# 🚕 NexRide — Production-Ready Uber Ride-Hailing Platform

A full-stack, real-time ride-hailing application built with **React 18**, **React Router**, **Node.js Express**, **Socket.IO**, **Leaflet Maps**, **Tailwind CSS**, and **SQLite (better-sqlite3)**. Designed for real-world operations with live GPS tracking, OSRM dynamic ETA dispatching with sequential driver failover, driver turn-by-turn HUD, wallet/payments, JWT role guards, and a Super Admin God-View dispatch center.

---

## 🌟 Key Highlights & Features

### 🚗 1. Rider Experience (Mobile-First 100dvh)
- **Interactive Geospatial Map**: Full Leaflet map with dark vector tiles, pickup & destination pins, glowing polyline routes, and live driver markers with smooth heading rotation.
- **Dynamic Vehicle Tiers**: Compare **Uber Go**, **UberX**, **Uber Comfort**, **UberXL**, **Uber Black**, **Uber Moto**, and **Uber Auto** with real-time upfront fare estimates, ETAs, and surge pricing.
- **Debounced Address Autocomplete**: Search proxy with quick preset filters (Airport, Train Station, City Mall, Tech Park).
- **OSRM ETA Real-Time Dispatching**: Radar scanning animation connecting with nearest drivers filtered by fastest driving ETA.
- **Trip Security PIN**: 4-digit security OTP generated for every ride to verify the driver before starting.
- **Live In-Trip Chat & In-App VoIP Call**: Bi-directional messaging and simulated encrypted in-app voice call HUD with mute and end actions.
- **SOS Panic Emergency**: Quick emergency broadcast button that alerts both parties and broadcasts to the Super Admin live console.
- **Post-Trip Settlement**: Itemized fare receipt, confetti animation, 5-star driver ratings, and tipping ($2, $5, $10, or custom).
- **Wallet & Promo System**: In-app wallet balance with instant top-up, transaction history, and promo coupon discounts (e.g. `SAVE20`, `NEX50`).

### 🚕 2. Driver Partner Experience (Turn-by-Turn HUD)
- **Online / Offline Toggle**: Go online to receive trip dispatches or offline to pause with visual status beacon.
- **15-Second Ride Acceptance Window**: Interactive animated SVG countdown ring with synthesized Web Audio chime, pickup distance, fare estimate, and rider rating.
- **Sequential Driver Failover**: If a driver declines or the 15-second window expires, the dispatch request seamlessly forwards to the next nearest driver by ETA.
- **Turn-by-Turn Navigation HUD**: Maneuver banner, remaining distance, speed meter, and real-time step instructions.
- **Trip Lifecycle Controls**:
  1. *Tap when Arrived at Pickup*
  2. *Verify Rider's 4-digit PIN & Start Trip*
  3. *Complete Trip & Collect Net Earnings*
- **Driver Earnings & Analytics**: Daily gross earnings, interactive weekly bar chart (Mon–Sun), completed trips counter, acceptance rate, and passenger review logs.

### ⚡ 3. Super Admin & Dispatch God-View
- **Live Fleet Dispatch Map**: Full overview of all active riders, online drivers, and trips in progress.
- **Financial Analytics**: Real-time Gross Volume ($), Net Platform Revenue (commission cut), and trip logs with isolated horizontal table scroll.
- **Dynamic Surge & Commission Controls**: Real-time sliders to adjust Surge Multipliers (1.0x - 3.5x) and Platform Commission rates (10% - 30%) with instant live broadcast to all active clients via Socket.IO.
- **Emergency SOS Dispatch Feed**: Real-time alert feed notifying admins when a rider triggers an emergency panic button.

### 📱 4. Mobile-First & Desktop Presentation
- **Mobile-First Layout**: Native feel at 360px–430px with 100dvh, safe-area insets (`env(safe-area-inset-*)`), and minimum 44px touch targets.
- **Desktop Phone Mockup Frame**: On desktop screens (>=768px/1280px), the rider and driver apps render inside a phone device frame with a companion workspace switcher beside it.
- **PWA Ready**: Web App Manifest (`manifest.json`), theme color, standalone orientation, and installable icons.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router, Tailwind CSS, Lucide Icons, Leaflet, Canvas Confetti |
| **Backend** | Node.js, Express.js, Socket.IO, CORS, Dotenv, UUID, JSON Web Tokens (JWT) |
| **Database** | SQLite via **`better-sqlite3`** with atomic transactions and WAL mode |
| **Routing & Geocoding** | Open Source Routing Machine (OSRM) + Nominatim Open APIs (zero paid API keys required) |
| **Audio** | Native Web Audio API Synthesizer (zero external audio file dependencies) |

---

## 🔑 Pre-Seeded Accounts

| Role | Email | Password | Name |
|---|---|---|---|
| **Rider** | `alex@example.com` | `rider123` | Alex Johnson |
| **Driver** | `michael.driver@example.com` | `driver123` | Michael Rodriguez |
| **Admin** | `admin@nexride.app` | `admin123` | Dispatch Commander |

*(Fast 1-click login buttons are also available in the Account Switch modal!)*

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18 or higher)
- npm

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
cd ..
```

### 2. Seed Database
```bash
npm run seed
```

### 3. Run Locally (Dev Mode)
To run both backend API and frontend Vite client concurrently:
```bash
npm run dev
```

- **Workspace Launcher**: [http://localhost:5173/](http://localhost:5173/)
- **Rider Portal**: [http://localhost:5173/rider](http://localhost:5173/rider)
- **Driver HUD**: [http://localhost:5173/driver](http://localhost:5173/driver)
- **Super Admin**: [http://localhost:5173/admin](http://localhost:5173/admin)
- **Backend API & WebSocket**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 📡 REST API & WebSocket Events

### REST Endpoints
- `GET /api/health` — Platform health, active rides, online driver count.
- `POST /api/auth/login` — JWT authentication for Rider, Driver, or Admin.
- `GET /api/auth/me` — Verify token and get current profile.
- `GET /api/users` — List pre-seeded accounts.
- `POST /api/rides/quotes` — Calculate OSRM route distance, duration, and fare quotes across all 7 vehicle tiers.
- `GET /api/rides/history/:userId` — Retrieve past trips and ratings for a user.
- `GET /api/wallet/:userId` — Get wallet balance and transaction ledger.
- `POST /api/wallet/topup` — Top-up in-app wallet balance.
- `GET /api/places/search?q=:query` — Address search and autocomplete proxy.
- `GET /api/admin/metrics` — Fleet analytics, revenue metrics, and trip logs.
- `POST /api/admin/settings` — Update surge multiplier and platform commission.

### Socket.IO Real-Time Events
- `driver:location_update` -> `driver:moved` — Real-time driver GPS telemetry.
- `ride:request` -> `ride:incoming_request` — Dispatch ride request to nearest driver by OSRM ETA.
- `ride:decline` — Driver declines request; backend forwards request to next nearest driver.
- `ride:accept` -> `ride:accepted` — Driver accepts ride with pickup route calculation.
- `ride:arrived` — Driver arrival alert.
- `ride:start` — Commences trip after 4-digit OTP PIN verification.
- `ride:complete` — Settles payment, deducts rider wallet, credits driver earnings, and emits receipt.
- `chat:send` -> `chat:message` — Bi-directional in-trip chat.
- `ride:sos` -> `admin:sos_alert` — SOS emergency broadcast.
