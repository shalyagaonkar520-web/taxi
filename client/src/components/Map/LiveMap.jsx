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

// Green = where you get in, red = where you get out. Same colours as the
// dots in the rider sheet, so the map and the text always agree.
const createPointIcon = (type = 'pickup') => {
  const isPickup = type === 'pickup';
  const color = isPickup ? '#06C167' : '#E11900';
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
  isPickerMode = false,
  pickerType = 'pickup',
  onPickerCenterChange = null
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkersRef = useRef(new Map());
  const pickupMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const driverRoutePolylineRef = useRef(null);

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

    // Trigger size recalculation after render
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Listen to map moveend for Picker Mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMoveEnd = () => {
      if (isPickerMode && onPickerCenterChange) {
        const c = map.getCenter();
        onPickerCenterChange({ lat: c.lat, lng: c.lng });
      }
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [isPickerMode, onPickerCenterChange]);

  // Pan to center when center prop changes.
  // In picker mode the centre is driven BY the user dragging, so flying
  // back to it would fight the drag.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (isPickerMode) return;
    if (map && center && center.length === 2 && !routeCoordinates?.length) {
      map.flyTo(center, zoom || 15, { duration: 1.0 });
    }
  }, [center, isPickerMode]);

  // Update Drivers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || isPickerMode) return;

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
        // Inline colours so the tooltip stays readable in light and dark mode
        const marker = L.marker([driver.location.lat, driver.location.lng], { icon })
          .addTo(map)
          .bindTooltip(`
            <div style="padding: 2px 4px; font-size: 12px; line-height: 1.35;">
              <div style="font-weight: 700; color: #ffffff;">${driver.name || 'Driver'}</div>
              <div style="color: #d4d4d8;">${driver.vehicle?.make || ''} ${driver.vehicle?.model || ''}</div>
            </div>
          `, {
            className: 'nexride-map-tooltip',
            direction: 'top',
            offset: [0, -18]
          });

        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, [drivers, assignedDriverId, isPickerMode]);

  // Update Pickup & Destination Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || isPickerMode) return;

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
  }, [pickup, destination, isPickerMode]);

  // Update Primary Trip Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || isPickerMode) return;

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
  }, [routeCoordinates, isPickerMode]);

  // Update Driver-to-Pickup Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || isPickerMode) return;

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
  }, [driverRouteCoordinates, isPickerMode]);

  return (
    <div className="relative w-full h-full min-h-[350px]">
      <div ref={mapRef} className="w-full h-full" />

      {/* Floating Rapido/Uber Center Pin in Picker Mode */}
      {isPickerMode && (
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
          <div className="relative flex flex-col items-center -translate-y-1/2">
            {/* Tag badge above pin */}
            <div className={`mb-2 px-3 py-1.5 rounded-full text-white text-xs font-black shadow-xl flex items-center gap-1.5 ${pickerType === 'pickup' ? 'bg-uber-green' : 'bg-uber-red'}`}>
              <span>{pickerType === 'pickup' ? 'Pick me up here' : 'Drop me here'}</span>
            </div>

            {/* Floating centre pin */}
            <div className="relative flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full ${pickerType === 'pickup' ? 'bg-uber-green ring-uber-green/25' : 'bg-uber-red ring-uber-red/25'} ring-8 flex items-center justify-center text-white shadow-xl border-2 border-white`}>
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
              <div className={`w-1 h-5 ${pickerType === 'pickup' ? 'bg-uber-green' : 'bg-uber-red'} shadow-md`} />
            </div>

            {/* Ground shadow dot */}
            <div className="w-4 h-2 bg-black/60 rounded-full blur-[1px] mt-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}
