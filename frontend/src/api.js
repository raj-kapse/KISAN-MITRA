/**
 * API helper — centralizes all backend calls.
 * Uses the Vite proxy in dev (/api/...) or a configured VITE_API_URL in prod.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Calls the /api/health endpoint to verify backend connectivity.
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

/**
 * Sends a crop leaf image to the backend for AI diagnosis.
 * @param {File} imageFile — the image file from input or camera capture
 * @returns {Promise<Object>} — { success, diagnosis }
 */
export async function diagnoseCrop(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const res = await fetch(`${API_BASE}/api/diagnose`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Diagnosis failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches weather data for a given location.
 */
export async function getWeather(lat, lon) {
  const res = await fetch(`${API_BASE}/api/weather?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Weather fetch failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches scan history from Firestore.
 */
export async function getHistory(limit = 20) {
  const res = await fetch(`${API_BASE}/api/history?limit=${limit}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `History fetch failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Saves a diagnosis scan to Firestore.
 */
export async function saveScanHistory(diagnosis, location = null) {
  const res = await fetch(`${API_BASE}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diagnosis, location }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Save failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches nearby agricultural stores.
 */
export async function getStores(lat, lon) {
  const res = await fetch(`${API_BASE}/api/stores?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Stores fetch failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches combined AI advice based on weather + diagnosis.
 */
export async function getAiWeatherAdvisory(diagnosis, weather, lang) {
  const res = await fetch(`${API_BASE}/api/weather-advisory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diagnosis, weather, lang }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Advisory fetch failed: ${res.status}`);
  }
  return res.json();
}
