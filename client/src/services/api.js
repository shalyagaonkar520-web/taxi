const API_BASE = window.location.port === '5173' ? 'http://localhost:5000/api' : '/api';

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users`);
  return res.json();
}

export async function fetchDrivers() {
  const res = await fetch(`${API_BASE}/drivers`);
  return res.json();
}

export async function searchPlaces(query, lat, lng) {
  if (!query) return [];
  const params = new URLSearchParams({ q: query });
  if (lat && lng) {
    params.append('lat', lat);
    params.append('lng', lng);
  }
  const res = await fetch(`${API_BASE}/places/search?${params.toString()}`);
  return res.json();
}

export async function reverseGeocodePlace(lat, lng) {
  const res = await fetch(`${API_BASE}/places/reverse?lat=${lat}&lng=${lng}`);
  return res.json();
}

export async function relocateDrivers(lat, lng) {
  const res = await fetch(`${API_BASE}/drivers/relocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  });
  return res.json();
}

export async function getFareQuotes(pickup, destination) {
  const res = await fetch(`${API_BASE}/rides/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pickup, destination })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to calculate fare quotes');
  }
  return res.json();
}

export async function fetchActiveRide(userId) {
  const res = await fetch(`${API_BASE}/rides/active/${userId}`);
  return res.json();
}

export async function fetchRideHistory(userId) {
  const res = await fetch(`${API_BASE}/rides/history/${userId}`);
  return res.json();
}

export async function fetchWallet(userId) {
  const res = await fetch(`${API_BASE}/wallet/${userId}`);
  return res.json();
}

export async function topupWallet(userId, amount, paymentMethod) {
  const res = await fetch(`${API_BASE}/wallet/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount, paymentMethod })
  });
  return res.json();
}

export async function fetchAdminMetrics() {
  const res = await fetch(`${API_BASE}/admin/metrics`);
  return res.json();
}

export async function updateAdminSettings(settings) {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return res.json();
}
