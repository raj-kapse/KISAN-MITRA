// backend/routes/geocode.js
// GET /api/geocode?q=<city name>
// Resolves a city name to coordinates with provider failover:
// OpenWeatherMap geocoding (primary) → Open-Meteo geocoding (keyless backup).
// Used as the manual fallback when browser geolocation is denied/unavailable.

const express = require('express');
const { geocodeWithFallback } = require('../services/weatherService');
const { geocodeRateLimit } = require('../middleware/rateLimit');
const router = express.Router();

router.get('/geocode', geocodeRateLimit, async (req, res) => {
  const q = (req.query.q || '').toString().trim();

  if (!q || q.length < 2 || q.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing city name. Example: /api/geocode?q=Nashik',
    });
  }

  try {
    const location = await geocodeWithFallback(q, process.env.OPENWEATHER_API_KEY);
    return res.json({ success: true, location });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: err.message });
    }
    console.error('[geocode] all providers failed:', err.message);
    return res.status(503).json({
      success: false,
      error: 'Could not reach any geocoding provider. Try again in a moment.',
    });
  }
});

module.exports = router;
