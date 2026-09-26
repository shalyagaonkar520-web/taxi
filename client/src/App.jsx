import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import LiveMap from './components/Map/LiveMap';
import RiderView from './components/Rider/RiderView';
import DriverView from './components/Driver/DriverView';
import AdminView from './components/Admin/AdminView';
import WalletModal from './components/WalletModal';
import HistoryModal from './components/HistoryModal';
import { socket, registerUser } from './services/socket';
import { fetchUsers, fetchDrivers, fetchActiveRide } from './services/api';

function getRoleFromPath() {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (path === '/driver' || path.startsWith('/driver/')) return 'DRIVER';
  if (path === '/admin' || path.startsWith('/admin/')) return 'ADMIN';
  if (path === '/rider' || path.startsWith('/rider/')) return 'RIDER';
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
            { role: 'rider', label: 'Rider', description: 'Book and track rides', color: 'bg-uber-accent' },
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

  /* ---------------- Theme ----------------
     Rider defaults to light and can toggle. Driver and admin keep the
     dark workspace they were designed for. */
  const isRider = role === 'RIDER';
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('nexride-theme') === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isRider) {
      root.classList.toggle('dark', theme === 'dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme, isRider]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('nexride-theme', next);
      } catch (e) {
        /* private mode - the theme just will not persist */
      }
      return next;
    });
  }, []);
  // Admin Live Operations Center state
  const [adminEntityFilter, setAdminEntityFilter] = useState('BOTH');
  const [adminLayers, setAdminLayers] = useState({ cabs: true, riders: true, trips: true, surge: false });
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);
  const [adminRiders, setAdminRiders] = useState([]);

  const handleAdminLayerToggle = (layerKey) => {
    setAdminLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Initial Load
  useEffect(() => {
    async function initData() {
      try {
        const [allUsers, allDrivers] = await Promise.all([fetchUsers(), fetchDrivers()]);
        setDrivers(allDrivers);

        const initialUser = allUsers.find((u) => u.role === role) || allUsers[0];
        setCurrentUser(initialUser);
        registerUser(initialUser.id, role);

        // Check active ride
        const active = await fetchActiveRide(initialUser.id);
        if (active) setActiveRide(active);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    initData();
  }, [role]);

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
          d.id === data.driverId ? { ...d, location: data.location, status: data.status || d.status } : d
        )
      );
    });

    // Driver status changed
    socket.on('driver:status_changed', ({ driverId, status }) => {
      setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, status } : d)));
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('init:state');
      socket.off('driver:moved');
      socket.off('driver:status_changed');
    };
  }, [currentUser, role]);

  /**
   * One explicit contract with RiderView:
   *   null                    -> no ride, clear everything
   *   { type: 'PREVIEW', … }  -> the rider is still planning
   *   a ride object           -> a real ride is running
   */
  const handleRiderUpdate = (data) => {
    if (!data) {
      setActiveRide(null);
      setPreviewRoute([]);
      setPreviewPickup(null);
      setPreviewDestination(null);
      return;
    }

    if (data.type === 'PREVIEW') {
      setPreviewPickup(data.pickup || null);
      setPreviewDestination(data.destination || null);
      setPreviewRoute(data.route || []);
      if (data.center?.lat != null) {
        setMapCenter([data.center.lat, data.center.lng]);
      }
      return;
    }

    setActiveRide(data);
    if (data.pickup?.lat != null) {
      setMapCenter([data.pickup.lat, data.pickup.lng]);
    }
  };

  const mapPickup = activeRide?.pickup || previewPickup;
  const mapDestination = activeRide?.destination || previewDestination;
  const mapRoute =
    activeRide?.tripRouteCoordinates || activeRide?.routeCoordinates || previewRoute;
  const driverRoute = activeRide?.status === 'IN_PROGRESS' ? [] : activeRide?.driverRouteCoordinates || [];

  const onlineDriverCount = drivers.filter((d) => d.status === 'ONLINE').length;

  const mapPanel = (
    <>
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

      {/* Floating status badge */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-2 px-3 py-2 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-md border border-slate-200 dark:border-white/15 shadow-lg text-xs font-bold text-slate-700 dark:text-gray-200">
        <span className="w-2 h-2 rounded-full bg-uber-green animate-pulse" />
        <span>{onlineDriverCount} drivers nearby</span>
      </div>
    </>
  );

  /* ---------------- Rider: map on top, details below ---------------- */
  if (isRider) {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-[#09090b]">
        <Navbar
          currentRole={role}
          user={currentUser}
          walletBalance={currentUser?.walletBalance}
          onOpenWallet={() => setShowWalletModal(true)}
          onOpenHistory={() => setShowHistoryModal(true)}
          isConnected={isConnected}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Map: top half on a phone, right side on a desktop */}
          <div className="relative h-[45vh] lg:h-auto shrink-0 lg:flex-1 lg:order-2">
            {mapPanel}
          </div>

          {/* Details sheet: bottom half on a phone, left column on a desktop */}
          <div
            data-rider-sheet
            className="relative z-20 flex-1 min-h-0 overflow-y-auto -mt-5 lg:mt-0 rounded-t-3xl lg:rounded-none bg-white dark:bg-[#111116] shadow-[0_-10px_30px_rgba(15,23,42,0.10)] lg:shadow-none lg:w-[430px] xl:w-[460px] lg:flex-none lg:order-1 lg:border-r lg:border-slate-200 lg:dark:border-white/10"
          >
            {/* grab handle, so the split reads as a sheet on mobile */}
            <div className="lg:hidden sticky top-0 z-10 flex justify-center pt-2.5 pb-1 bg-white dark:bg-[#111116]">
              <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/20" />
            </div>

      {/* Main Content Area */}
      <div className="relative flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Floating Interactive Panel */}
        <div className={`z-30 w-full md:w-auto ${role === 'ADMIN' ? 'md:max-w-lg lg:max-w-xl' : 'md:max-w-md'} p-4 lg:p-6 overflow-y-auto pointer-events-auto flex flex-col justify-start`}>
          {role === 'RIDER' && (
            <RiderView
              user={currentUser}
              drivers={drivers}
              activeRide={activeRide}
              onRideUpdate={handleRiderUpdate}
              onOpenWallet={() => setShowWalletModal(true)}
              onOpenHistory={() => setShowHistoryModal(true)}
            />
          </div>
        </div>

        {showWalletModal && (
          <WalletModal
            user={currentUser}
            onClose={() => setShowWalletModal(false)}
            onBalanceUpdate={(newBalance) => {
              setCurrentUser((prev) => ({ ...prev, walletBalance: newBalance }));
            }}
          />
        )}

        {showHistoryModal && (
          <HistoryModal user={currentUser} onClose={() => setShowHistoryModal(false)} />
        )}
      </div>
    );
  }

  /* ---------------- Driver / Admin workspaces (unchanged) ---------------- */
  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden bg-[#09090b]">
      <Navbar
        currentRole={role}
        user={currentUser}
        walletBalance={currentUser?.walletBalance}
        onOpenWallet={() => setShowWalletModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        isConnected={isConnected}
      />

      <div className="relative flex-1 w-full h-[calc(100vh-64px)] flex flex-col lg:flex-row items-stretch justify-between p-3 lg:p-5 gap-4 overflow-hidden">
        <div className="z-20 w-full md:w-96 flex-shrink-0 overflow-y-auto pointer-events-auto flex flex-col">
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
              <AdminView
                drivers={drivers}
                isConnected={isConnected}
                onCenterMap={setMapCenter}
                entityFilter={adminEntityFilter}
                onFilterChange={setAdminEntityFilter}
                activeLayers={adminLayers}
                onLayerToggle={handleAdminLayerToggle}
                selectedDriver={selectedDriver}
                onSelectDriver={setSelectedDriver}
                selectedRider={selectedRider}
                onSelectRider={setSelectedRider}
                riders={adminRiders}
                setRiders={setAdminRiders}
              />
            </div>
          )}
        </div>

        <div className="relative flex-1 w-full h-full min-h-[350px] lg:min-h-0 rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#121216]">
          {mapPanel}
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
            entityFilter={role === 'ADMIN' ? adminEntityFilter : 'BOTH'}
            activeLayers={role === 'ADMIN' ? adminLayers : undefined}
            onDriverClick={role === 'ADMIN' ? setSelectedDriver : undefined}
            onRiderClick={role === 'ADMIN' ? setSelectedRider : undefined}
            selectedDriverId={role === 'ADMIN' ? selectedDriver?.id : undefined}
            selectedRiderId={role === 'ADMIN' ? selectedRider?.id : undefined}
            riders={role === 'ADMIN' ? adminRiders : []}
          />
        </div>
      </div>

      {showWalletModal && (
        <WalletModal
          user={currentUser}
          onClose={() => setShowWalletModal(false)}
          onBalanceUpdate={(newBalance) => {
            setCurrentUser((prev) => ({ ...prev, walletBalance: newBalance }));
          }}
        />
      )}

      {showHistoryModal && (
        <HistoryModal user={currentUser} onClose={() => setShowHistoryModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  const role = getRoleFromPath();
  return role ? <RoleApp role={role} /> : <RoleLauncher />;
}
