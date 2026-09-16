// backend/routes/weather.js
// GET /api/weather?lat=&lon=
// Returns current weather + 5-day forecast from OpenWeatherMap.
// Matches the { success, error } convention used in diagnose.js and health.js.

const express = require('express');
const router = express.Router();

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

function isValidCoord(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

router.get('/weather', async (req, res) => {
  const { lat, lon } = req.query;

  if (!isValidCoord(lat, -90, 90) || !isValidCoord(lon, -180, 180)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing lat/lon. Example: /api/weather?lat=19.87&lon=75.34',
    });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'OPENWEATHER_API_KEY not configured on server',
    });
  }

  const query = `lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${OWM_BASE}/weather?${query}`),
      fetch(`${OWM_BASE}/forecast?${query}`),
    ]);

    if (currentRes.status === 401 || forecastRes.status === 401) {
      return res.status(503).json({
        success: false,
        error: 'OpenWeatherMap rejected the API key (401). Check OPENWEATHER_API_KEY.',
      });
    }

    if (!currentRes.ok || !forecastRes.ok) {
      return res.status(503).json({
        success: false,
        error: `OpenWeatherMap error: current=${currentRes.status} forecast=${forecastRes.status}`,
      });
    }

    const current = await currentRes.json();
    const forecastRaw = await forecastRes.json();

    // Forecast returns 3-hour chunks. Reduce to one entry per day.
    const byDay = new Map();
    for (const item of forecastRaw.list || []) {
      const date = item.dt_txt.split(' ')[0];
      if (!byDay.has(date)) byDay.set(date, item);
    }

    const forecast = Array.from(byDay.values())
      .slice(0, 5)
      .map((item) => ({
        date: item.dt_txt.split(' ')[0],
        temp_min: Math.round(item.main.temp_min),
        temp_max: Math.round(item.main.temp_max),
        humidity: item.main.humidity,
        description: item.weather?.[0]?.description || '',
        rain_probability: item.pop ? Math.round(item.pop * 100) : 0,
        wind_speed: item.wind?.speed ?? null,
      }));

    return res.json({
      success: true,
      current: {
        temp: Math.round(current.main.temp),
        feels_like: Math.round(current.main.feels_like),
        humidity: current.main.humidity,
        description: current.weather?.[0]?.description || '',
        wind_speed: current.wind?.speed ?? null,
        city: current.name || null,
      },
      forecast,
    });
  } catch (err) {
    console.error('[weather] fetch failed:', err.message);
    return res.status(503).json({
      success: false,
      error: 'Could not reach OpenWeatherMap. Try again in a moment.',
    });
  }
});

module.exports = router;