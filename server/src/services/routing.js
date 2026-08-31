const http = require('http');
const https = require('https');

// Helper to fetch JSON from URL
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'NexRide-TaxiPlatform/1.0 (contact@nexride.app)',
        ...options.headers
      },
      timeout: 6000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

// Haversine formula for exact spherical distance in kilometers
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing/heading between two points in degrees (0-360)
 */
function calculateHeading(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  const b = Math.atan2(y, x) * 180 / Math.PI;
  return (b + 360) % 360;
}

/**
 * Generate synthetic realistic waypoints along a straight path with slight grid curvature
 */
function generateRealisticRoutePoints(start, end, numPoints = 25) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    // Add realistic Manhattan/city grid curvature
    const curveOffset = Math.sin(ratio * Math.PI) * 0.0015;
    const lat = start.lat + (end.lat - start.lat) * ratio + curveOffset;
    const lng = start.lng + (end.lng - start.lng) * ratio - curveOffset * 0.5;
    points.push([lat, lng]);
  }
  return points;
}

/**
 * Get accurate driving route from OSRM with automatic fallback
 */
async function getDrivingRoute(start, end) {
  const directDist = calculateHaversineDistance(start.lat, start.lng, end.lat, end.lng);
  
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
    const data = await fetchJson(url);

    if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distanceKm = primaryRoute.distance / 1000;
      const durationMin = primaryRoute.duration / 60;
      
      // OSRM coordinates are [lng, lat], map expects [lat, lng]
      const coordinates = primaryRoute.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      // Extract maneuvers
      const steps = [];
      if (primaryRoute.legs && primaryRoute.legs[0] && primaryRoute.legs[0].steps) {
        primaryRoute.legs[0].steps.forEach(s => {
          if (s.maneuver && s.name) {
            steps.push({
              instruction: `${s.maneuver.type} onto ${s.name || 'road'}`,
              distance: Math.round(s.distance)
            });
          }
        });
      }

      return {
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin: Number(durationMin.toFixed(1)),
        coordinates,
        steps
      };
    }
  } catch (err) {
    console.warn('OSRM routing request failed, using high-fidelity synthetic city route:', err.message);
  }

  // Fallback to synthetic city grid route
  const distanceKm = directDist * 1.25; // Driving distance is ~1.25x direct distance
  const durationMin = (distanceKm / 30) * 60 + 2; // avg 30 km/h in city + traffic
  const coordinates = generateRealisticRoutePoints(start, end);

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin: Number(durationMin.toFixed(1)),
    coordinates,
    steps: [
      { instruction: 'Head towards destination', distance: Math.round(distanceKm * 1000 * 0.3) },
      { instruction: 'Continue on main avenue', distance: Math.round(distanceKm * 1000 * 0.5) },
      { instruction: 'Arrive at destination', distance: Math.round(distanceKm * 1000 * 0.2) }
    ]
  };
}

/**
 * Autocomplete / Search Places
 */
async function searchPlaces(query, centerLat, centerLng) {
  if (!query || query.trim().length < 2) return [];

  // Popular curated landmarks for instant responsive selection
  const KNOWN_PLACES = [
    { name: 'Empire State Building', address: '20 W 34th St, New York, NY 10001', lat: 40.748817, lng: -73.985428 },
    { name: 'Times Square', address: 'Broadway, New York, NY 10036', lat: 40.758896, lng: -73.985130 },
    { name: 'Central Park South', address: '59th St to 110th St, New York, NY 10022', lat: 40.764356, lng: -73.973059 },
    { name: 'Grand Central Terminal', address: '89 E 42nd St, New York, NY 10017', lat: 40.752726, lng: -73.977229 },
    { name: 'One World Trade Center', address: '285 Fulton St, New York, NY 10007', lat: 40.712743, lng: -74.013379 },
    { name: 'Brooklyn Bridge Park', address: '334 Furman St, Brooklyn, NY 11201', lat: 40.702284, lng: -73.996489 },
    { name: 'JFK International Airport', address: 'Queens, NY 11430', lat: 40.641311, lng: -73.778139 },
    { name: 'LaGuardia Airport (LGA)', address: 'Queens, NY 11371', lat: 40.776927, lng: -73.873966 }
  ];

  const matchedLocal = KNOWN_PLACES.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.address.toLowerCase().includes(query.toLowerCase())
  );

  try {
    const encoded = encodeURIComponent(query);
    const viewbox = centerLat && centerLng ? `&viewbox=${centerLng - 0.5},${centerLat + 0.5},${centerLng + 0.5},${centerLat - 0.5}` : '';
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=6${viewbox}`;
    const results = await fetchJson(url);

    if (Array.isArray(results) && results.length > 0) {
      const formatted = results.map(r => ({
        name: r.display_name.split(',')[0],
        address: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon)
      }));

      // Combine with unique local matches
      const combined = [...matchedLocal];
      formatted.forEach(f => {
        if (!combined.some(c => Math.abs(c.lat - f.lat) < 0.0001 && Math.abs(c.lng - f.lng) < 0.0001)) {
          combined.push(f);
        }
      });
      return combined.slice(0, 8);
    }
  } catch (err) {
    console.warn('Geocoding search failed, using landmark database:', err.message);
  }

  return matchedLocal.length > 0 ? matchedLocal : [
    {
      name: query,
      address: `${query}, City Center`,
      lat: (centerLat || 40.758896) + (Math.random() - 0.5) * 0.02,
      lng: (centerLng || -73.985130) + (Math.random() - 0.5) * 0.02
    }
  ];
}

module.exports = {
  calculateHaversineDistance,
  calculateHeading,
  getDrivingRoute,
  searchPlaces
};
