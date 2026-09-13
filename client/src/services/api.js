const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE = (configuredApiUrl || '/api').replace(/\/$/, '');

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' ? payload.error : payload;
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return payload;
}

export async function fetchUsers() {
  return request('/users');
}

export async function fetchDrivers() {
  return request('/drivers');
}

export async function searchPlaces(query, lat, lng) {
  if (!query) return [];
  const params = new URLSearchParams({ q: query });
  if (lat && lng) {
    params.append('lat', lat);
    params.append('lng', lng);
  }
  return request(`/places/search?${params.toString()}`);
}

export async function reverseGeocodePlace(lat, lng) {
  return request(`/places/reverse?lat=${lat}&lng=${lng}`);
}

export async function relocateDrivers(lat, lng) {
  return request('/drivers/relocate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  });
}

export async function getFareQuotes(pickup, destination) {
  return request('/rides/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pickup, destination })
  });
}

export async function fetchActiveRide(userId) {
  return request(`/rides/active/${userId}`);
}

export async function fetchRideHistory(userId) {
  return request(`/rides/history/${userId}`);
}

export async function fetchWallet(userId) {
  return request(`/wallet/${userId}`);
}

export async function topupWallet(userId, amount, paymentMethod) {
  return request('/wallet/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount, paymentMethod })
  });
}

export async function fetchAdminMetrics() {
  return request('/admin/metrics');
}

export async function updateAdminSettings(settings) {
  return request('/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}
