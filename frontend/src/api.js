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
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
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
    // Don't set Content-Type — browser sets it with boundary for multipart
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Diagnosis failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches weather data for a given location.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>}
 */
export async function getWeather(lat, lon) {
  const res = await fetch(`${API_BASE}/api/weather?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Weather fetch failed: ${res.status}`);
  }
  return res.json();
}
