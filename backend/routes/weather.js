// backend/routes/weather.js
// GET /api/weather?lat=&lon=
// Current weather + 5-day forecast with provider failover:
// OpenWeatherMap (primary) → Open-Meteo (keyless backup).
// The frontend contract ({ success, current, forecast }) is unchanged.

const express = require('express');
const { getWeatherWithFallback } = require('../services/weatherService');
const { weatherRateLimit } = require('../middleware/rateLimit');
const router = express.Router();

function isValidCoord(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

router.get('/weather', weatherRateLimit, async (req, res) => {
  const { lat, lon } = req.query;

  if (!isValidCoord(lat, -90, 90) || !isValidCoord(lon, -180, 180)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing lat/lon. Example: /api/weather?lat=19.87&lon=75.34',
    });
  }

  try {
    const { current, forecast, provider } = await getWeatherWithFallback(lat, lon);
    return res.json({ success: true, current, forecast, provider });
  } catch (err) {
    console.error('[weather] all providers failed:', err.message);
    return res.status(503).json({
      success: false,
      error: 'Could not reach any weather provider. Try again in a moment.',
    });
  }
});

module.exports = router;
