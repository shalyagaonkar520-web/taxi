import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Custom SVG Markers
const createVehicleIcon = (category = 'UberX', heading = 0, isAssigned = false) => {
  const iconColor = isAssigned ? '#06C167' : '#276EF1';
  const size = isAssigned ? 42 : 36;

  const svg = `
    <div style="transform: rotate(${heading}deg); transition: transform 0.3s ease; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
      <div style="background: #121216; border: 2px solid ${iconColor}; border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.6);">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size - 14}" height="${size - 14}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <path d="M9 17h6"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
      <div style="position: absolute; top: -6px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid ${iconColor};"></div>
    </div>
  `;

  return L.divIcon({
    html: svg,
    className: 'vehicle-marker-icon',
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
  heatmapZones = [],
  showHeatmap = false,
  onMapClick = null
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkersRef = useRef(new Map());
  const pickupMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const driverRoutePolylineRef = useRef(null);
  const heatmapLayersRef = useRef([]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(center, zoom);

    // OpenStreetMap high-speed clean tile provider (No API key required)
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
      map.flyTo(center, zoom || 15, { duration: 1.2 });
    }
  }, [center]);

  // Update Drivers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

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
      const heading = driver.location.heading || 0;
      const icon = createVehicleIcon(driver.vehicle?.category, heading, isAssigned);

      if (driverMarkersRef.current.has(driver.id)) {
        const marker = driverMarkersRef.current.get(driver.id);
        marker.setLatLng([driver.location.lat, driver.location.lng]);
        marker.setIcon(icon);
      } else {
        const marker = L.marker([driver.location.lat, driver.location.lng], { icon })
          .addTo(map)
          .bindTooltip(`
            <div class="p-1 text-xs font-semibold">
              <span class="text-white">${driver.name}</span>
              <div class="text-gray-300 font-normal">${driver.vehicle?.make} ${driver.vehicle?.model}</div>
            </div>
          `, { className: 'glass-dropdown rounded-lg shadow-xl' });

        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, [drivers, assignedDriverId]);

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

    if (routeCoordinates && routeCoordinates.length > 1) {
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

      // Auto fit bounds
      try {
        const bounds = L.latLngBounds(routeCoordinates);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch (e) {}
    } else if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
  }, [routeCoordinates]);

  // Update Driver-to-Pickup Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (driverRouteCoordinates && driverRouteCoordinates.length > 1) {
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
  }, [driverRouteCoordinates]);

  // Render Demand Surge Heatmap Zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    heatmapLayersRef.current.forEach((layer) => {
      try { layer.remove(); } catch (e) {}
    });
    heatmapLayersRef.current = [];

    if (showHeatmap && heatmapZones && heatmapZones.length > 0) {
      heatmapZones.forEach((zone) => {
        const circle = L.circle([zone.lat, zone.lng], {
          color: zone.color || '#EF4444',
          fillColor: zone.color || '#EF4444',
          fillOpacity: 0.22,
          weight: 2,
          radius: zone.radius || 1200
        }).addTo(map);

        const badgeIcon = L.divIcon({
          html: `
            <div style="background: rgba(18, 18, 22, 0.92); border: 1.5px solid ${zone.color}; color: #FFFFFF; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); white-space: nowrap; pointer-events: auto; cursor: pointer;">
              <span style="color: ${zone.color}; font-size: 11px;">⚡</span>
              <span>${zone.surgeMultiplier}x</span>
              <span style="color: #9CA3AF; font-size: 9px; font-weight: 600;">${zone.name}</span>
            </div>
          `,
          className: 'surge-badge-icon',
          iconAnchor: [50, 12]
        });

        const badge = L.marker([zone.lat, zone.lng], { icon: badgeIcon }).addTo(map);
        badge.bindPopup(`
          <div style="color: #111; font-size: 12px; font-weight: 700;">
            <p style="margin: 0; font-size: 13px; color: ${zone.color};">${zone.surgeMultiplier}x Surge Zone</p>
            <p style="margin: 4px 0 0 0; font-weight: 500; font-size: 11px; color: #4B5563;">${zone.description}</p>
          </div>
        `);

        heatmapLayersRef.current.push(circle, badge);
      });
    }
  }, [heatmapZones, showHeatmap]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
