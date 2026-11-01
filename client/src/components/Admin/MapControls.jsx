import React, { useState, useEffect, useRef } from 'react';
import {
  Car,
  User,
  Users,
  Search,
  Layers,
  Check,
  MapPin,
  X,
  Info,
  ChevronDown
} from 'lucide-react';
import LiveConnectionIndicator from './LiveConnectionIndicator';
import { searchPlaces } from '../../services/api';

export default function MapControls({
  entityFilter = 'BOTH',
  onFilterChange,
  activeLayers = { cabs: true, riders: true, trips: true, surge: false },
  onLayerToggle,
  onSelectLocation,
  isConnected = true,
  cabsCount = 0,
  ridersWithCoordsCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);
  const layersDropdownRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (layersDropdownRef.current && !layersDropdownRef.current.contains(e.target)) {
        setShowLayersMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search places
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(searchQuery);
        setSearchResults(results || []);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Failed to search locations:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  const handleSelectPlace = (place) => {
    if (onSelectLocation && place.lat && place.lng) {
      onSelectLocation({
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lng),
        address: place.display_name || place.name
      });
    }
    setSearchQuery(place.display_name?.split(',')[0] || place.name || '');
    setShowSearchDropdown(false);
  };

  return (
    <div className="w-full flex flex-col gap-3 pointer-events-auto">
      {/* Main Operations Control Bar */}
      <div className="bg-[#121216]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col gap-3">
        {/* Top Row: Title + Live Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-uber-accent animate-pulse" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
              Live Operations
            </h2>
          </div>
          <LiveConnectionIndicator isConnected={isConnected} />
        </div>

        {/* Second Row: Filter Buttons [ CABS ] [ RIDERS ] [ BOTH ] + Layers Menu */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
          {/* Entity Filter Pill Group */}
          <div className="inline-flex p-1 rounded-2xl bg-black/50 border border-white/5 text-xs">
            <button
              onClick={() => onFilterChange('CABS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                entityFilter === 'CABS'
                  ? 'bg-uber-accent text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Display cabs & drivers only"
            >
              <Car className="w-3.5 h-3.5" />
              <span>CABS</span>
              {cabsCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  entityFilter === 'CABS' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {cabsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onFilterChange('RIDERS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                entityFilter === 'RIDERS'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Display rider markers"
            >
              <User className="w-3.5 h-3.5" />
              <span>RIDERS</span>
              {ridersWithCoordsCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                  {ridersWithCoordsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onFilterChange('BOTH')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                entityFilter === 'BOTH'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Display both cabs and riders"
            >
              <Users className="w-3.5 h-3.5" />
              <span>BOTH</span>
            </button>
          </div>

          {/* Layers Dropdown Toggle */}
          <div className="relative" ref={layersDropdownRef}>
            <button
              onClick={() => setShowLayersMenu(!showLayersMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-black/40 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-uber-accent" />
              <span>Layers</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showLayersMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#18181b] border border-white/10 shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                <p className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Map Layers
                </p>

                <button
                  onClick={() => onLayerToggle('cabs')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-left text-gray-200"
                >
                  <span className="flex items-center gap-2">
                    <Car className="w-3.5 h-3.5 text-uber-accent" /> Drivers / Cabs
                  </span>
                  {activeLayers.cabs && <Check className="w-3.5 h-3.5 text-uber-accent" />}
                </button>

                <button
                  onClick={() => onLayerToggle('riders')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-left text-gray-200"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-purple-400" /> Riders
                  </span>
                  {activeLayers.riders && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </button>

                <button
                  onClick={() => onLayerToggle('trips')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-left text-gray-200"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Active Trips
                  </span>
                  {activeLayers.trips && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button
                  onClick={() => onLayerToggle('surge')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 text-left text-gray-200"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-xs">⚡</span> Surge Zones
                  </span>
                  {activeLayers.surge && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Third Row: Search Location Bar */}
        <div className="relative" ref={searchContainerRef}>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-uber-accent/60 transition-all">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city, neighborhood, or address..."
              className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                }}
                className="text-gray-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Suggestions Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl max-h-56 overflow-y-auto z-50 p-1">
              {searchResults.map((place, idx) => (
                <button
                  key={place.place_id || idx}
                  onClick={() => handleSelectPlace(place)}
                  className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/5 text-left text-xs transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-uber-accent shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">
                      {place.display_name?.split(',')[0] || place.name}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {place.display_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Rider Telemetry Status Banner */}
      {(entityFilter === 'RIDERS' || entityFilter === 'BOTH') && (
        <div className="px-4 py-2.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-xs text-zinc-300 flex items-center gap-2 shadow-lg animate-in fade-in duration-200">
          <Info className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-[11px] leading-tight">
            {ridersWithCoordsCount === 0
              ? 'No active riders currently requesting or taking a trip. (Idle riders are not tracked via background GPS)'
              : `${ridersWithCoordsCount} active rider${ridersWithCoordsCount > 1 ? 's' : ''} currently on live dispatch / trips.`}
          </span>
        </div>
      )}
    </div>
  );
}
