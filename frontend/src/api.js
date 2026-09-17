/**
 * API helper — centralizes all backend calls.
 * Uses the Vite proxy in dev (/api/...) or a configured VITE_API_URL in prod.
 */

export const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Anonymous per-device ID used to scope scan history to this device.
 * Survives reloads (localStorage); falls back to a session-only ID if
 * storage is unavailable. Not a login — just privacy scoping so farmers
 * don't see each other's scans in a shared Firestore collection.
 */
const DEVICE_ID_KEY = 'kisan_mitra_device_id';
let cachedDeviceId = null;
export function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    cachedDeviceId = id;
    return id;
  } catch {
    // Storage blocked — session-only ID
    if (!cachedDeviceId) {
      cachedDeviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return cachedDeviceId;
  }
}

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
 * Saves a diagnosis scan to Firestore (or the local fallback store),
 * tagged with the logged-in farmer's profile when one exists.
 */
export async function saveScanHistory(diagnosis, location = null, profile = null) {
  const res = await fetch(`${API_BASE}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnosis,
      location,
      deviceId: getDeviceId(),
      profileId: profile?.id || null,
      profileName: profile?.name || null,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Save failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches scan history — scoped to the logged-in profile when given,
 * otherwise to this device.
 */
export async function getHistory(limit = 20, profile = null) {
  const scope = profile?.id
    ? `profileId=${encodeURIComponent(profile.id)}`
    : `deviceId=${encodeURIComponent(getDeviceId())}`;
  const res = await fetch(`${API_BASE}/api/history?limit=${limit}&${scope}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `History fetch failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Login-or-register a farmer profile by phone (name required for new phones).
 * A 409 response means "phone is new, name required".
 */
export async function loginProfile(phone, name = '') {
  const res = await fetch(`${API_BASE}/api/profile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    const err = new Error(body.error || `Sign-in failed: ${res.status}`);
    err.nameRequired = Boolean(body.nameRequired);
    throw err;
  }
  return body.profile;
}

/**
 * Resolves a city name to coordinates (manual fallback when geolocation is denied).
 */
export async function geocodeCity(query) {
  const res = await fetch(`${API_BASE}/api/geocode?q=${encodeURIComponent(query)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error || `Location search failed: ${res.status}`);
  }
  return body.location;
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

/**
 * Generates spoken audio (WAV blob) for the given text via the backend's
 * Gemini TTS fallback — used when the browser has no speech voices.
 * @returns {Promise<Blob>} audio/wav blob ready for <audio>.play()
 */
export async function speakViaServer(text, lang = 'en') {
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Speech generation failed: ${res.status}`);
  }
  return res.blob();
}
