import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LiveMap from './components/Map/LiveMap';
import RiderView from './components/Rider/RiderView';
import DriverView from './components/Driver/DriverView';
import AdminView from './components/Admin/AdminView';
import WalletModal from './components/WalletModal';
import HistoryModal from './components/HistoryModal';
import { socket, registerUser } from './services/socket';
import { fetchUsers, fetchDrivers, fetchActiveRide } from './services/api';

export default function App() {
  const [role, setRole] = useState('RIDER'); // 'RIDER' | 'DRIVER' | 'ADMIN'
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [previewRoute, setPreviewRoute] = useState([]);
  const [previewPickup, setPreviewPickup] = useState(null);
  const [previewDestination, setPreviewDestination] = useState(null);
  const [mapCenter, setMapCenter] = useState([40.752726, -73.977229]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Modals
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Initial Load
  useEffect(() => {
    async function initData() {
      try {
        const [allUsers, allDrivers] = await Promise.all([
          fetchUsers(),
          fetchDrivers()
        ]);
        setUsers(allUsers);
        setDrivers(allDrivers);

        const initialRider = allUsers.find(u => u.role === 'RIDER') || allUsers[0];
        setCurrentUser(initialRider);
        registerUser(initialRider.id, 'RIDER');

        // Check active ride
        const active = await fetchActiveRide(initialRider.id);
        if (active) setActiveRide(active);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    initData();
  }, []);

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

  // Switch Role
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    let targetUser = null;
    if (newRole === 'RIDER') {
      targetUser = users.find(u => u.role === 'RIDER') || users[0];
    } else if (newRole === 'DRIVER') {
      targetUser = users.find(u => u.role === 'DRIVER') || drivers[0];
    } else if (newRole === 'ADMIN') {
      targetUser = users.find(u => u.role === 'ADMIN') || users.find(u => u.id === 'admin-01');
    }

    if (targetUser) {
      setCurrentUser(targetUser);
      registerUser(targetUser.id, newRole);
    }
  };

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

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden bg-[#09090b]">
      {/* Top Navbar */}
      <Navbar
        currentRole={role}
        onRoleChange={handleRoleChange}
        user={currentUser}
        walletBalance={currentUser?.walletBalance}
        onOpenWallet={() => setShowWalletModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        isConnected={isConnected}
      />

      {/* Main Content Area */}
      <div className="relative flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Floating Interactive Panel */}
        <div className="z-30 w-full md:w-auto md:max-w-md p-4 lg:p-6 overflow-y-auto pointer-events-auto flex flex-col justify-start">
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

        {/* Live Background Interactive Map */}
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
