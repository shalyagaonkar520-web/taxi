# 🚕 NexRide — Production-Ready Uber Ride-Hailing Platform

A full-stack, real-time ride-hailing application built with **React 18**, **Node.js Express**, **Socket.IO**, **Leaflet Maps**, and **Tailwind CSS**. Designed for real-world operations with live GPS tracking, dynamic dispatch, driver turn-by-turn HUD, wallet/payments, and a Super Admin God-View dispatch center.

---

## 🌟 Key Features

### 🚗 1. Rider Experience
- **Interactive Geospatial Map**: Full Leaflet map with dark vector tiles, pickup & destination pins, glowing polyline routes, and live driver markers with smooth heading rotation.
- **Dynamic Vehicle Tiers**: Compare **Uber Go**, **UberX**, **Uber Comfort**, **UberXL**, **Uber Black**, **Uber Moto**, and **Uber Auto** with real-time upfront fare estimates, ETAs, and surge pricing.
- **Real-Time Dispatching**: Radar scanning animation searching for nearby active drivers.
- **Trip Security PIN**: 4-digit security OTP generated for every ride to verify the driver before starting.
- **Live In-Trip Chat & Call**: Bi-directional messaging between rider and driver.
- **SOS Panic Emergency**: Quick emergency broadcast button.
- **Post-Trip Settlement**: Itemized fare receipt, confetti animation, 5-star driver ratings, and custom tipping ($2, $5, $10).
- **Wallet & Promo System**: In-app wallet balance with instant top-up, transaction history, and promo coupon discounts (e.g. `SAVE20`).

### 🚕 2. Driver Partner Experience
- **Online / Offline Toggle**: Go online to receive trip dispatches or offline to pause.
- **15-Second Ride Acceptance Window**: Interactive countdown alert with synthesized audio chime, pickup distance, fare estimate, and rider rating.
- **Turn-by-Turn Navigation HUD**: Maneuver banner, remaining distance, speed, and real-time step instructions.
- **Trip Lifecycle Controls**:
  1. *Tap when Arrived at Pickup*
  2. *Verify Rider's 4-digit PIN & Start Trip*
  3. *Complete Trip & Collect Fare*
- **Driver Earnings & Analytics**: Daily gross earnings, weekly performance, completed trips counter, and customer review logs.

### ⚡ 3. Super Admin & Dispatch God-View
- **Live Fleet Dispatch Map**: Full overview of all active riders, online drivers, and trips in progress.
- **Financial Analytics**: Real-time Gross Volume ($), Net Platform Revenue (20% commission cut), and trip logs.
- **Dynamic Surge & Commission Controls**: Real-time sliders to adjust Surge Multipliers (1.0x - 3.5x) and Platform Commission rates (10% - 30%) with instant broadcast to all active clients.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons, Leaflet, Canvas Confetti |
| **Backend** | Node.js, Express.js, Socket.IO, CORS, Dotenv, UUID |
| **Database** | PostgreSQL 16 with JSONB state persistence |
| **Routing & Geocoding** | Open Source Routing Machine (OSRM) + Nominatim Open APIs (zero paid API keys required) |
| **Audio** | Native Web Audio API Synthesizer (zero external audio asset dependencies) |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

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

### 2. Run Locally (Dev Mode)
To run both backend and frontend concurrently with one command:
```bash
npm run dev
```

- **Role workspaces**:
  - Rider: [http://localhost:5173/rider](http://localhost:5173/rider)
  - Driver: [http://localhost:5173/driver](http://localhost:5173/driver)
  - Admin: [http://localhost:5173/admin](http://localhost:5173/admin)
- **Workspace launcher**: [http://localhost:5173](http://localhost:5173)
- **Backend API & WebSocket Server**: [http://localhost:5000](http://localhost:5000)

### Production Configuration

The frontend uses same-origin `/api` and Socket.IO paths by default, which works
when a reverse proxy serves the client and forwards those paths to the server.
For separate deployments, copy the example files and set:

```bash
cp client/.env.example client/.env.production
cp server/.env.example server/.env
```

- `VITE_API_URL`: backend URL including `/api`, for example
  `https://api.example.com/api`.
- `VITE_SOCKET_URL`: backend origin, for example `https://api.example.com`.
- `CORS_ORIGIN`: comma-separated frontend origins, for example
  `https://app.example.com`.
- `DATABASE_URL`: PostgreSQL connection string. The local Docker example uses
  `postgresql://postgres:password123@localhost:5434/nexride_dev`.

Before publishing, confirm the backend responds at `/api/health`, the frontend
can reach the configured API URL, and the Socket.IO connection is established.
Do not commit `.env` files or production secrets.

### Database Migration

The server creates the `nexride_state` table on startup. On an empty database,
it imports the existing `server/data/db.json` seed state; subsequent writes are
persisted to PostgreSQL. The JSON file remains as a local recovery fallback when
`DATABASE_URL` is not configured.

### Firebase Authentication

Firebase Authentication is optional for local development and becomes available
when the Firebase web settings are added to `client/.env` and the Firebase Admin
service-account JSON is added only to `server/.env`.

In Firebase Console:

1. Enable **Email/Password** and **Google** sign-in providers.
2. Add the authorized local and production domains.
3. Create the one admin account using the email in `ADMIN_EMAIL`.
4. Download a service account from **Project settings → Service accounts** and
  set its JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` on the server.

Riders and drivers can then create accounts, sign in with Google, and request
password-reset emails. Admin accounts cannot be self-created; the server only
accepts the configured admin email for the admin workspace.

---

## 📡 REST API & WebSocket Events

### REST Endpoints
- `GET /api/health` — Platform health check, online drivers count, active rides.
- `GET /api/users` — List pre-seeded Rider, Driver, and Admin accounts.
- `POST /api/rides/quotes` — Calculate route distance, duration, and fare quotes across all vehicle tiers.
- `GET /api/rides/history/:userId` — Retrieve past trips and ratings for a user.
- `GET /api/wallet/:userId` — Get wallet balance and transaction ledger.
- `POST /api/wallet/topup` — Top-up in-app wallet balance.
- `GET /api/places/search?q=:query` — Address search and autocomplete proxy.
- `GET /api/admin/metrics` — Fleet analytics, revenue metrics, and trip logs.
- `POST /api/admin/settings` — Update surge multiplier and platform commission.

### Socket.IO Real-Time Events
- `driver:location_update` / `driver:moved` — Real-time driver GPS telemetry.
- `ride:request` / `ride:incoming_request` — Dispatch ride request to nearby drivers.
- `ride:accept` / `ride:accepted` — Driver accepts ride with pickup route calculation.
- `ride:arrived` — Driver arrival alert.
- `ride:start` — Commences trip after 4-digit OTP PIN verification.
- `ride:complete` — Finalizes trip, settles payments, and generates receipts.
- `chat:send` / `chat:message` — Real-time in-trip rider-driver chat.

---

## 📤 Pushing to GitHub

To push the codebase to your repository:
```bash
git push -u origin main
```
*(Make sure you have authenticated your GitHub account or configured a Personal Access Token / SSH key).*

---

## 📄 License
This project is licensed under the ISC License.
