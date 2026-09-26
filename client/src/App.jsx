import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import LiveMap from './components/Map/LiveMap';
import RiderView from './components/Rider/RiderView';
import DriverView from './components/Driver/DriverView';
import AdminView from './components/Admin/AdminView';
import WalletModal from './components/WalletModal';
import HistoryModal from './components/HistoryModal';
import AuthModal from './components/AuthModal';
import PhoneFrame from './components/PhoneFrame';
import BottomSheet from './components/BottomSheet';
import { socket, registerUser } from './services/socket';
import { fetchUsers, fetchDrivers, fetchActiveRide } from './services/api';
import { Car, Navigation, ShieldCheck, User, Sparkles, Layers, ArrowRight } from 'lucide-react';

function getRoleFromPath() {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (path === '/driver' || path.startsWith('/driver/')) return 'DRIVER';
  if (path === '/admin' || path.startsWith('/admin/')) return 'ADMIN';
  if (path === '/rider' || path.startsWith('/rider/')) return 'RIDER';
  return null;
}

function RoleLauncher() {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRole, setAuthRole] = useState('RIDER');

  const workspaces = [
    {
      role: 'rider',
      roleEnum: 'RIDER',
      label: 'Rider Workspace',
      tag: 'Mobile-First',
      description: 'Book rides across 7 tiers, live GPS ETA radar, in-trip chat & wallet',
      color: 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500/30',
      icon: Car,
      demoName: 'Alex Johnson'
    },
    {
      role: 'driver',
      roleEnum: 'DRIVER',
      label: 'Driver Partner HUD',
      tag: 'Turn-by-Turn',
      description: '15s acceptance window, audio chime, turn-by-turn HUD, PIN start & earnings',
      color: 'from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 border-emerald-500/30',
      icon: Navigation,
      demoName: 'Michael Rodriguez'
    },
    {
      role: 'admin',
      roleEnum: 'ADMIN',
      label: 'Super Admin God-View',
      tag: 'Fleet Control',
      description: 'Live fleet telemetry, revenue gross & take cut, instant surge & commission sliders',
      color: 'from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border-purple-500/30',
      icon: ShieldCheck,
      demoName: 'Dispatch Commander'
    }
  ];

  return (
    <main className="min-h-[100dvh] w-full bg-[#09090b] text-white flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 flex flex-col gap-8">
        
        {/* Header */}
        <div className="text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>NexRide Urban Mobility Platform</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              Choose your role workspace
            </h1>
            <p className="text-sm md:text-base text-gray-400 mt-2 max-w-xl">
              Production-grade real-time Uber-style platform powered by React 18, Node.js, Socket.IO, and SQLite.
            </p>
          </div>

          <button
            onClick={() => {
              setAuthRole('RIDER');
              setShowAuthModal(true);
            }}
            className="touch-target px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-2"
          >
            <User className="w-4 h-4 text-blue-400" />
            <span>Switch Demo Account</span>
          </button>
        </div>

        {/* 3 Workspaces Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {workspaces.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.role}
                onClick={() => navigate(`/${item.role}`)}
                className={`group cursor-pointer rounded-3xl p-6 bg-gradient-to-b ${item.color} border shadow-xl flex flex-col justify-between min-h-[220px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.99]`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full bg-black/30 border border-white/20 text-white">
                      {item.tag}
                    </span>
                  </div>

                  <h2 className="text-xl font-black text-white group-hover:text-white flex items-center justify-between">
                    {item.label}
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </h2>
                  <p className="text-xs text-white/80 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-white/90">
                  <span>Demo Profile:</span>
                  <span className="font-bold">{item.demoName}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tech Stack Info Banner */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>SQLite atomic WAL database active</span>
          </div>
          <div className="flex items-center gap-4">
            <span>OSRM Dynamic ETA Dispatching</span>
            <span>Web Audio API Synthesizer</span>
            <span>100dvh Mobile-First</span>
          </div>
        </div>

      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        targetRole={authRole}
        onLoginSuccess={(user) => {
          navigate(`/${user.role.toLowerCase()}`);
        }}
      />
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
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Driver Heatmap
  const [showDriverHeatmap, setShowDriverHeatmap] = useState(false);
  const [driverHeatmapZones, setDriverHeatmapZones] = useState([]);

  useEffect(() => {
    if (role === 'DRIVER') {
      fetch('/api/driver/heatmap')
        .then(r => r.ok ? r.json() : [])
        .then(zones => setDriverHeatmapZones(zones))
        .catch(() => {});
    }
  }, [role]);

  // Initial Data Load
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
        const [allUsers, allDrivers] = await Promise.all([
          fetchUsers(),
          fetchDrivers()
        ]);
        setDrivers(allDrivers);

        // Check stored user in localStorage or default to role-matched account
        let initialUser = null;
        const stored = localStorage.getItem('nexride_user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.role === role) initialUser = parsed;
          } catch (e) {}
        }

        if (!initialUser) {
          initialUser = allUsers.find((u) => u.role === role) || allUsers[0];
        }

        setCurrentUser(initialUser);
        registerUser(initialUser.id, role);

        // Check active ride for user
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

    socket.on('init:state', (data) => {
      if (data.drivers) setDrivers(data.drivers);
      if (data.activeRide) setActiveRide(data.activeRide);
    });

    socket.on('driver:moved', (data) => {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === data.driverId
            ? { ...d, location: data.location, status: data.status || d.status }
            : d
        )
      );
    });

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

  return (
    <PhoneFrame role={role} activeRide={activeRide} driversCount={drivers.filter(d => d.status === 'ONLINE').length}>
      <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#09090b]">
        {/* Top Navbar with Safe Inset awareness */}
        <Navbar
          currentRole={role}
          user={currentUser}
          walletBalance={currentUser?.walletBalance}
          onOpenWallet={() => setShowWalletModal(true)}
          onOpenHistory={() => setShowHistoryModal(true)}
          onSwitchAccount={() => setShowAuthModal(true)}
          isConnected={isConnected}
        />

        {/* Main Content Area: Map fills background; interactive panels sit on top */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          
          {/* Live Background Interactive Map */}
          <div className="absolute inset-0 z-0">
            <LiveMap
              center={mapCenter}
              zoom={14}
      {/* Main Content Area */}
      <div className="relative flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Floating Interactive Panel */}
        <div className={`z-30 w-full md:w-auto ${role === 'ADMIN' ? 'md:max-w-lg lg:max-w-xl' : 'md:max-w-md'} p-4 lg:p-6 overflow-y-auto pointer-events-auto flex flex-col justify-start`}>
          {role === 'RIDER' && (
            <RiderView
              user={currentUser}
              drivers={drivers}
              pickup={mapPickup}
              destination={mapDestination}
              routeCoordinates={mapRoute}
              driverRouteCoordinates={driverRoute}
              assignedDriverId={activeRide?.driverId}
              heatmapZones={driverHeatmapZones}
              showHeatmap={showDriverHeatmap && role === 'DRIVER'}
            />
          </div>

          {/* Interactive Floating Panel for Admin or Desktop View */}
          {role === 'ADMIN' ? (
            <div className="relative z-20 w-full h-full overflow-y-auto p-2 md:p-6 bg-[#09090b]/80 backdrop-blur-md">
              <AdminView drivers={drivers} />
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
          ) : role === 'DRIVER' ? (
            <div className="relative z-20 w-full h-full pointer-events-none">
              <DriverView
                driver={currentUser}
                activeRide={activeRide}
                onRideUpdate={setActiveRide}
                onStatusChange={(status) => {
                  if (currentUser) {
                    setCurrentUser({ ...currentUser, status });
                  }
                }}
                showHeatmap={showDriverHeatmap}
                onToggleHeatmap={() => setShowDriverHeatmap(!showDriverHeatmap)}
                heatmapZones={driverHeatmapZones}
              />
            </div>
          ) : (
            <div className="relative z-20 w-full h-full pointer-events-none flex flex-col justify-end">
              <div className="pointer-events-auto p-3 sm:p-4 max-w-md w-full mx-auto max-h-[85dvh] overflow-y-auto">
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
          )}

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

        {/* Auth / Account Switch Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            targetRole={role}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              registerUser(user.id, role);
            }}
          />
        )}
      </div>
    </PhoneFrame>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleLauncher />} />
        <Route path="/rider" element={<RoleApp role="RIDER" />} />
        <Route path="/driver" element={<RoleApp role="DRIVER" />} />
        <Route path="/admin" element={<RoleApp role="ADMIN" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
