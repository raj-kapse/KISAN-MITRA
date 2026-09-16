/**
 * Rate limiter — Kisan Mitra
 *
 * Minimal in-memory fixed-window rate limiter for the AI-costing routes.
 * Keyed by client IP. No external dependency; state resets on restart,
 * which is acceptable for a hackathon prototype protecting a free-tier
 * Gemini/OpenWeather quota. For multi-instance deployment, swap for a
 * shared store (e.g. Redis).
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
 * @param {number} max — max requests per window per client
 * @param {number} windowMs — window length in milliseconds
 */
function createRateLimiter(max, windowMs = 60_000) {
  return function rateLimit(req, res, next) {
    const key = `${req.ip || 'unknown'}:${max}:${windowMs}`;
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

module.exports = { createRateLimiter };
