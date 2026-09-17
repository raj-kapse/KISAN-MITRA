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

// Pre-built instances — imported by individual route files
const aiRateLimit = createRateLimiter('ai', 20, 60_000);
const weatherRateLimit = createRateLimiter('weather', 60, 60_000);

module.exports = { createRateLimiter, aiRateLimit, weatherRateLimit };
