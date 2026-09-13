import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LiveMap from './components/Map/LiveMap';
import RiderView from './components/Rider/RiderView';
import DriverView from './components/Driver/DriverView';
import AdminView from './components/Admin/AdminView';
import WalletModal from './components/WalletModal';
import HistoryModal from './components/HistoryModal';
import LoginView from './components/LoginView';
import { socket, registerUser } from './services/socket';
import { fetchDrivers, fetchActiveRide } from './services/api';

function getRoleFromPath() {
  const path = window.location.pathname.toLowerCase();
  if (path === '/driver') return 'DRIVER';
  if (path === '/admin') return 'ADMIN';
  if (path === '/user' || path === '/rider') return 'RIDER';
  return null;
}

function RoleLauncher() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">NexRide platform</p>
        <h1 className="text-4xl font-black tracking-tight mb-3">Choose your workspace</h1>
        <p className="text-gray-400 mb-8">Each role has its own dedicated application.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { role: 'user', label: 'User', description: 'Book and track rides', color: 'bg-uber-accent' },
            { role: 'driver', label: 'Driver', description: 'Manage trips and earnings', color: 'bg-uber-green' },
            { role: 'admin', label: 'Admin', description: 'Monitor the entire fleet', color: 'bg-purple-600' }
          ].map((item) => (
            <a
              key={item.role}
              href={`/${item.role}`}
              className={`${item.color} rounded-2xl p-5 min-h-36 flex flex-col justify-end hover:brightness-110 transition-all`}
            >
              <span className="text-xl font-bold">{item.label}</span>
              <span className="text-sm text-white/75 mt-1">{item.description}</span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

function RoleApp({ role }) {
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [previewRoute, setPreviewRoute] = useState([]);
  const [previewPickup, setPreviewPickup] = useState(null);
  const [previewDestination, setPreviewDestination] = useState(null);
  const [mapCenter, setMapCenter] = useState([12.9716, 77.5946]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Modals
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load shared fleet data after the user signs in.
  useEffect(() => {
    async function initData() {
      try {
        const allDrivers = await fetchDrivers();
        setDrivers(allDrivers);

        setCurrentUser(authenticatedUser);
        registerUser(authenticatedUser.id, role);

        // Check active ride
        const active = await fetchActiveRide(authenticatedUser.id);
        if (active) setActiveRide(active);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    initData();
  }, [role, authenticatedUser]);

  // Handle Socket Connection & Real-Time Sync
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      if (currentUser) {
        registerUser(currentUser.id, role);
      }
    };
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setIsConnected(socket.connected);

    // Initial state snapshot from socket server
    socket.on('init:state', (data) => {
      if (data.drivers) setDrivers(data.drivers);
      if (data.activeRide) setActiveRide(data.activeRide);
    });

    // Driver location movements
    socket.on('driver:moved', (data) => {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === data.driverId
            ? { ...d, location: data.location, status: data.status || d.status }
            : d
        )
      );
    });

    // Driver status changed
    socket.on('driver:status_changed', ({ driverId, status }) => {
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, status } : d))
      );
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('init:state');
      socket.off('driver:moved');
      socket.off('driver:status_changed');
    };
  }, [currentUser, role]);

  // Handle Rider preview or trip updates
  const handleRiderUpdate = (data) => {
    if (!data) {
      setActiveRide(null);
      setPreviewRoute([]);
      return;
    }
    if (data.userLocation) {
      setMapCenter([data.userLocation.lat, data.userLocation.lng]);
    }
    if (data.previewRoute) {
      setPreviewRoute(data.previewRoute);
      setPreviewPickup(data.pickup);
      setPreviewDestination(data.destination);
      if (data.pickup && data.pickup.lat && !data.userLocation) {
        setMapCenter([data.pickup.lat, data.pickup.lng]);
      }
    } else if (data.userLocation && !data.id) {
      setPreviewPickup(data.pickup || null);
      setPreviewDestination(data.destination || null);
    } else {
      setActiveRide(data);
      if (data.pickup && data.pickup.lat) {
        setMapCenter([data.pickup.lat, data.pickup.lng]);
      }
    }
  };

  const mapPickup = activeRide?.pickup || previewPickup;
  const mapDestination = activeRide?.destination || previewDestination;
  const mapRoute = activeRide?.routeCoordinates || previewRoute;
  const driverRoute = activeRide?.driverRouteCoordinates || [];

  if (!authenticatedUser) {
    return <LoginView role={role} onLogin={setAuthenticatedUser} />;
  }

  return (
    <div className={`relative w-screen min-h-screen flex flex-col bg-[#09090b] ${role === 'ADMIN' ? 'overflow-y-auto' : 'h-screen overflow-hidden'}`}>
      {/* Top Navbar */}
      <Navbar
        currentRole={role}
        user={currentUser}
        walletBalance={currentUser?.walletBalance}
        onOpenWallet={() => setShowWalletModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        isConnected={isConnected}
      />

      {/* Main Content Area */}
      <div className={`relative flex-1 w-full flex flex-col md:flex-row ${role === 'ADMIN' ? 'overflow-visible' : 'h-full overflow-hidden'}`}>
        
        {/* Left Floating Interactive Panel */}
        <div className={`z-30 w-full ${role === 'ADMIN' ? 'max-w-7xl mx-auto p-4 lg:p-8' : 'md:w-auto md:max-w-md p-4 lg:p-6 overflow-y-auto'} pointer-events-auto flex flex-col justify-start`}>
          {role === 'RIDER' && (
            <RiderView
              user={currentUser}
              drivers={drivers}
              activeRide={activeRide}
              onRideUpdate={handleRiderUpdate}
              onOpenWallet={() => setShowWalletModal(true)}
              onOpenHistory={() => setShowHistoryModal(true)}
            />
          )}

          {role === 'DRIVER' && (
            <DriverView
              driver={currentUser}
              activeRide={activeRide}
              onRideUpdate={setActiveRide}
              onStatusChange={(status) => {
                if (currentUser) {
                  setCurrentUser({ ...currentUser, status });
                }
              }}
            />
          )}

          {role === 'ADMIN' && (
            <div className="w-full">
              <AdminView drivers={drivers} />
            </div>
          )}
        </div>

        {role !== 'ADMIN' && (
          <div className="absolute inset-0 z-0">
            <LiveMap
              center={mapCenter}
              zoom={14}
              drivers={drivers}
              pickup={mapPickup}
              destination={mapDestination}
              routeCoordinates={mapRoute}
              driverRouteCoordinates={driverRoute}
              assignedDriverId={activeRide?.driverId}
            />
          </div>
        )}

      </div>

      {/* Wallet Top-Up Modal */}
      {showWalletModal && (
        <WalletModal
          user={currentUser}
          onClose={() => setShowWalletModal(false)}
          onBalanceUpdate={(newBalance) => {
            setCurrentUser((prev) => ({ ...prev, walletBalance: newBalance }));
          }}
        />
      )}

      {/* Past Ride History Modal */}
      {showHistoryModal && (
        <HistoryModal
          user={currentUser}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  const role = getRoleFromPath();
  return role ? <RoleApp role={role} /> : <RoleLauncher />;
}
