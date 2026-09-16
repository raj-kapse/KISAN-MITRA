// backend/routes/geocode.js
// GET /api/geocode?q=<city name>
// Resolves a city name to coordinates via OpenWeatherMap geocoding API.
// Used as the manual fallback when browser geolocation is denied/unavailable.

const express = require('express');
const router = express.Router();

const OWM_GEO_BASE = 'https://api.openweathermap.org/geo/1.0';

router.get('/geocode', async (req, res) => {
  const q = (req.query.q || '').toString().trim();

  if (!q || q.length < 2 || q.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing city name. Example: /api/geocode?q=Nashik',
    });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'OPENWEATHER_API_KEY not configured on server',
    });
  }

  try {
    const url = `${OWM_GEO_BASE}/direct?q=${encodeURIComponent(q)}&limit=1&appid=${apiKey}`;
    const geoRes = await fetch(url);

    if (geoRes.status === 401) {
      return res.status(503).json({
        success: false,
        error: 'OpenWeatherMap rejected the API key (401). Check OPENWEATHER_API_KEY.',
      });
    }
    if (!geoRes.ok) {
      return res.status(503).json({
        success: false,
        error: `OpenWeatherMap geocoding error: ${geoRes.status}`,
      });
    }

    const results = await geoRes.json();
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No location found for "${q}". Check the spelling or try a nearby larger town.`,
      });
    }

    const hit = results[0];
    return res.json({
      success: true,
      location: {
        name: hit.name,
        state: hit.state || null,
        country: hit.country || null,
        lat: hit.lat,
        lon: hit.lon,
      },
    });
  } catch (err) {
    console.error('[geocode] fetch failed:', err.message);
    return res.status(503).json({
      success: false,
      error: 'Could not reach OpenWeatherMap. Try again in a moment.',
    });
  }
});

module.exports = router;
