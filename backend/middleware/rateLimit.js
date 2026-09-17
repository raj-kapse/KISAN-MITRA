/**
 * Rate limiter — Kisan Mitra
 *
 * Minimal in-memory fixed-window rate limiter for the AI-costing routes.
 * Keyed by client IP + limiter name. No external dependency; state resets
 * on restart, which is acceptable for a hackathon prototype protecting a
 * free-tier Gemini/OpenWeather quota. For multi-instance deployment, swap
 * for a shared store (e.g. Redis).
 *
 * IMPORTANT: Apply each limiter INSIDE the specific router on the exact
 * route handler — NOT on app.use('/api', limiter, router), which fires
 * the limiter for every /api/* request regardless of which router handles it.
 */

const buckets = new Map(); // key -> { count, windowStart }

// Periodically drop stale buckets so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > bucket.windowMs * 2) buckets.delete(key);
  }
}, 60_000).unref();

/**
 * Create a rate-limiting middleware.
 * @param {string} name  — unique limiter name (used in bucket key to isolate counters)
 * @param {number} max   — max requests per window per client
 * @param {number} windowMs — window length in milliseconds
 */
function createRateLimiter(name, max, windowMs = 60_000) {
  return function rateLimit(req, res, next) {
    const key = `${req.ip || 'unknown'}:${name}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      bucket = { count: 0, windowStart: now, windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: `Too many requests — please wait ${retryAfterSec}s and try again.`,
      });
    }

    return next();
  };
}

// Pre-built instances — imported by individual route files.
// Per-feature buckets (H3): one farmer scan flow = diagnose + advisory +
// possible TTS. Sharing a single 'ai' bucket let chat + scanning together
// exhaust the limit, so each feature gets its own budget.
const diagnoseRateLimit = createRateLimiter('diagnose', 10, 60_000);
const chatRateLimit = createRateLimiter('chat', 15, 60_000);
const advisoryRateLimit = createRateLimiter('advisory', 15, 60_000);
const ttsRateLimit = createRateLimiter('tts', 15, 60_000);
const transcribeRateLimit = createRateLimiter('transcribe', 10, 60_000);
const weatherRateLimit = createRateLimiter('weather', 60, 60_000);
// Geocoding and history were unrated: geocoding fans out to two upstream
// providers (an abuse vector) and history is a write endpoint.
const geocodeRateLimit = createRateLimiter('geocode', 30, 60_000);
const historyReadRateLimit = createRateLimiter('history-read', 60, 60_000);
const historyWriteRateLimit = createRateLimiter('history-write', 30, 60_000);

module.exports = {
  createRateLimiter,
  chatRateLimit,
  diagnoseRateLimit,
  advisoryRateLimit,
  ttsRateLimit,
  transcribeRateLimit,
  weatherRateLimit,
  geocodeRateLimit,
  historyReadRateLimit,
  historyWriteRateLimit,
};
