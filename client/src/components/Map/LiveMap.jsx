import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Custom SVG Vehicle Markers with Status Differentiation
const createVehicleIcon = (
  category = 'UberX',
  heading = 0,
  isAssigned = false,
  status = 'ONLINE',
  isSelected = false
) => {
  let iconColor = '#06C167'; // Default online available (emerald)
  if (isAssigned) {
    iconColor = '#276EF1'; // Assigned to trip (Uber blue)
  } else if (status === 'BUSY') {
    iconColor = '#F59E0B'; // Busy / on trip (amber)
  } else if (status === 'OFFLINE') {
    iconColor = '#64748B'; // Offline (slate gray)
  }

  const size = isSelected ? 44 : isAssigned ? 42 : 36;
  const borderColor = isSelected ? '#FFFFFF' : iconColor;
  const borderWidth = isSelected ? 3 : 2;
  const glow = isSelected
    ? 'box-shadow: 0 0 18px rgba(255,255,255,0.7), 0 4px 14px rgba(0,0,0,0.8);'
    : 'box-shadow: 0 4px 14px rgba(0,0,0,0.6);';

  const svg = `
    <div style="transform: rotate(${heading}deg); transition: transform 0.3s ease; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="background: #121216; border: ${borderWidth}px solid ${borderColor}; border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; ${glow}">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size - 14}" height="${size - 14}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <path d="M9 17h6"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
      <div style="position: absolute; top: -6px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid ${borderColor};"></div>
    </div>
  `;

  return L.divIcon({
    html: svg,
    className: 'vehicle-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

// Custom SVG Rider Marker with Lifecycle Status Differentiation
const createRiderIcon = (status = 'REQUESTED', isSelected = false) => {
  let mainColor = '#A855F7'; // Purple default
  let badgeColor = '#C084FC';
  let pulseAnimation = '';

  if (status === 'REQUESTED') {
    mainColor = '#F59E0B'; // Amber - matching/requesting
    badgeColor = '#FBBF24';
    pulseAnimation = 'animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;';
  } else if (status === 'ACCEPTED') {
    mainColor = '#3B82F6'; // Blue - driver en route
    badgeColor = '#60A5FA';
    pulseAnimation = 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;';
  } else if (status === 'ARRIVED') {
    mainColor = '#10B981'; // Emerald - driver arrived at pickup
    badgeColor = '#34D399';
    pulseAnimation = 'animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;';
  } else if (status === 'IN_PROGRESS') {
    mainColor = '#8B5CF6'; // Violet - in transit in vehicle
    badgeColor = '#A78BFA';
  }

  const size = isSelected ? 44 : 38;
  const borderColor = isSelected ? '#FFFFFF' : mainColor;
  const borderWidth = isSelected ? 3 : 2;
  const glow = isSelected
    ? 'box-shadow: 0 0 20px rgba(255,255,255,0.85), 0 4px 14px rgba(0,0,0,0.8);'
    : 'box-shadow: 0 4px 14px rgba(0,0,0,0.6);';

  const svg = `
    <div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer; ${pulseAnimation}">
      <div style="background: #111827; border: ${borderWidth}px solid ${borderColor}; border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; ${glow}">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size - 14}" height="${size - 14}" viewBox="0 0 24 24" fill="none" stroke="${badgeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div style="position: absolute; bottom: -3px; width: 8px; height: 8px; background: ${mainColor}; border: 1.5px solid #111827; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html: svg,
    className: 'rider-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

const createPointIcon = (type = 'pickup') => {
  const isPickup = type === 'pickup';
  const color = isPickup ? '#276EF1' : '#E11900';
  const label = isPickup ? 'A' : 'B';

  const svg = `
    <div style="display: flex; flex-direction: column; align-items: center;">
      <div style="background: ${color}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; box-shadow: 0 0 16px ${color}88; border: 2px solid #ffffff;">
        ${label}
      </div>
      <div style="width: 2px; height: 10px; background: ${color};"></div>
      <div style="width: 8px; height: 4px; background: rgba(0,0,0,0.4); border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html: svg,
    className: 'point-marker-icon',
    iconSize: [32, 46],
    iconAnchor: [16, 46]
  });
};

export default function LiveMap({
  center = [12.9716, 77.5946],
  zoom = 14,
  drivers = [],
  pickup = null,
  destination = null,
  routeCoordinates = [],
  driverRouteCoordinates = [],
  assignedDriverId = null,
  onMapClick = null,
  // Optional Live Operations features (with backward-compatible defaults)
  entityFilter = 'BOTH', // 'CABS' | 'RIDERS' | 'BOTH'
  onDriverClick = null,
  onRiderClick = null,
  selectedDriverId = null,
  selectedRiderId = null,
  riders = [],
  activeLayers = { cabs: true, riders: true, trips: true, surge: false }
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkersRef = useRef(new Map());
  const riderMarkersRef = useRef(new Map());
  const pickupMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const driverRoutePolylineRef = useRef(null);
  const surgeCircleRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(center, zoom);

    // OpenStreetMap tile provider
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    // Add custom zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Pan to center when center prop changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && center && center.length === 2 && !routeCoordinates?.length) {
      map.flyTo(center, zoom || 14, { duration: 1.2 });
    }
  }, [center]);

  // Update Drivers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const shouldShowCabs = entityFilter !== 'RIDERS' && activeLayers?.cabs !== false;

    if (!shouldShowCabs) {
      driverMarkersRef.current.forEach((marker) => marker.remove());
      driverMarkersRef.current.clear();
      return;
    }

    const currentDriverIds = new Set(drivers.map(d => d.id));

    // Remove markers that are no longer active
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentDriverIds.has(id)) {
        marker.remove();
        driverMarkersRef.current.delete(id);
      }
    });

    // Update or add driver markers
    drivers.forEach(driver => {
      if (!driver.location || !driver.location.lat) return;

      const isAssigned = driver.id === assignedDriverId;
      const isSelected = driver.id === selectedDriverId;
      const heading = driver.location.heading || 0;
      const icon = createVehicleIcon(
        driver.vehicle?.category,
        heading,
        isAssigned,
        driver.status,
        isSelected
      );

      if (driverMarkersRef.current.has(driver.id)) {
        const marker = driverMarkersRef.current.get(driver.id);
        marker.setLatLng([driver.location.lat, driver.location.lng]);
        marker.setIcon(icon);
      } else {
        const marker = L.marker([driver.location.lat, driver.location.lng], { icon })
          .addTo(map)
          .bindTooltip(`
            <div class="p-1 text-xs font-semibold">
              <div class="flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full ${
                  driver.status === 'BUSY' ? 'bg-amber-400' : 'bg-emerald-400'
                }"></span>
                <span class="text-white">${driver.name}</span>
              </div>
              <div class="text-gray-300 font-normal mt-0.5">${driver.vehicle?.make || 'Vehicle'} ${driver.vehicle?.model || ''} • ${driver.status || 'ONLINE'}</div>
            </div>
          `, { className: 'glass-dropdown rounded-lg shadow-xl' });

        if (onDriverClick) {
          marker.on('click', () => {
            onDriverClick(driver);
          });
        }

        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, [drivers, assignedDriverId, entityFilter, activeLayers?.cabs, selectedDriverId, onDriverClick]);

  // Update Riders on Map (if rider coordinates exist in state)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const shouldShowRiders = entityFilter !== 'CABS' && activeLayers?.riders !== false;

    if (!shouldShowRiders || !riders || riders.length === 0) {
      riderMarkersRef.current.forEach((marker) => marker.remove());
      riderMarkersRef.current.clear();
      return;
    }

    const currentRiderIds = new Set();

    riders.forEach((rider) => {
      let lat = rider.location?.lat || rider.lat;
      let lng = rider.location?.lng || rider.lng;

      // In transit: follow assigned driver's live GPS directly from latest drivers state
      if (rider.rideStatus === 'IN_PROGRESS' && rider.driverId) {
        const assigned = drivers.find((d) => d.id === rider.driverId);
        if (assigned?.location?.lat && assigned?.location?.lng) {
          lat = assigned.location.lat;
          lng = assigned.location.lng;
        }
      }

      if (!lat || !lng) return;

      currentRiderIds.add(rider.id);
      const isSelected = rider.id === selectedRiderId;
      const icon = createRiderIcon(rider.rideStatus || 'REQUESTED', isSelected);

      const statusBadge =
        rider.rideStatus === 'REQUESTED'
          ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-300">REQUESTING</span>'
          : rider.rideStatus === 'ACCEPTED'
          ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/20 text-blue-300">DISPATCHED</span>'
          : rider.rideStatus === 'ARRIVED'
          ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300">DRIVER ARRIVED</span>'
          : rider.rideStatus === 'IN_PROGRESS'
          ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300 animate-pulse">ON TRIP</span>'
          : '';

      const tripSnippet = rider.destination?.address
        ? `<div class="text-[10px] text-gray-300 truncate max-w-[180px] mt-0.5">To: ${rider.destination.address.split(',')[0]}</div>`
        : '';

      if (riderMarkersRef.current.has(rider.id)) {
        const marker = riderMarkersRef.current.get(rider.id);
        marker.setLatLng([lat, lng]);
        marker.setIcon(icon);
      } else {
        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindTooltip(`
            <div class="p-1.5 text-xs font-semibold">
              <div class="flex items-center gap-1.5">
                <span class="text-white font-bold">${rider.name}</span>
                ${statusBadge}
              </div>
              ${tripSnippet}
              <div class="text-[9px] text-gray-400 mt-1">${rider.category || 'Ride'} • Tap for dispatch details</div>
            </div>
          `, { className: 'glass-dropdown rounded-lg shadow-xl' });

        if (onRiderClick) {
          marker.on('click', () => {
            onRiderClick(rider);
          });
        }

        riderMarkersRef.current.set(rider.id, marker);
      }
    });

    riderMarkersRef.current.forEach((marker, id) => {
      if (!currentRiderIds.has(id)) {
        marker.remove();
        riderMarkersRef.current.delete(id);
      }
    });
  }, [riders, drivers, entityFilter, activeLayers?.riders, selectedRiderId, onRiderClick]);

  // Optional Surge Heat Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeLayers?.surge) {
      if (!surgeCircleRef.current && center && center.length === 2) {
        surgeCircleRef.current = L.circle(center, {
          color: '#F59E0B',
          fillColor: '#F59E0B',
          fillOpacity: 0.15,
          radius: 1600,
          weight: 2,
          dashArray: '6, 6'
        }).addTo(map);
      }
    } else if (surgeCircleRef.current) {
      surgeCircleRef.current.remove();
      surgeCircleRef.current = null;
    }
  }, [activeLayers?.surge, center]);

  // Update Pickup & Destination Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Pickup
    if (pickup && pickup.lat) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
      } else {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], {
          icon: createPointIcon('pickup')
        }).addTo(map);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    // Destination
    if (destination && destination.lat) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      } else {
        destinationMarkerRef.current = L.marker([destination.lat, destination.lng], {
          icon: createPointIcon('destination')
        }).addTo(map);
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }
  }, [pickup, destination]);

  // Update Primary Trip Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const showTrips = activeLayers?.trips !== false;

    if (showTrips && routeCoordinates && routeCoordinates.length > 1) {
      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs(routeCoordinates);
      } else {
        routePolylineRef.current = L.polyline(routeCoordinates, {
          color: '#276EF1',
          weight: 6,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      }

      try {
        const bounds = L.latLngBounds(routeCoordinates);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch (e) {}
    } else if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
  }, [routeCoordinates, activeLayers?.trips]);

  // Update Driver-to-Pickup Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const showTrips = activeLayers?.trips !== false;

    if (showTrips && driverRouteCoordinates && driverRouteCoordinates.length > 1) {
      if (driverRoutePolylineRef.current) {
        driverRoutePolylineRef.current.setLatLngs(driverRouteCoordinates);
      } else {
        driverRoutePolylineRef.current = L.polyline(driverRouteCoordinates, {
          color: '#06C167',
          weight: 5,
          opacity: 0.85,
          dashArray: '8, 8',
          lineCap: 'round'
        }).addTo(map);
      }
    } else if (driverRoutePolylineRef.current) {
      driverRoutePolylineRef.current.remove();
      driverRoutePolylineRef.current = null;
    }
  }, [driverRouteCoordinates, activeLayers?.trips]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
