/**
 * API helper — centralizes all backend calls.
 * Uses the Vite proxy in dev (/api/...) or a configured VITE_API_URL in prod.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Calls the /api/health endpoint to verify backend connectivity.
 * Returns the parsed JSON response or throws on failure.
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Calls the /api/ping endpoint for a minimal latency check.
 */
export async function ping() {
  const res = await fetch(`${API_BASE}/api/ping`);
  if (!res.ok) {
    throw new Error(`Ping failed: ${res.status}`);
  }
  return res.json();
}
