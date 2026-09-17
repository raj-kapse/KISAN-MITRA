const express = require('express');
const { weatherRateLimit } = require('../middleware/rateLimit');
const router = express.Router();

/**
 * GET /api/stores?lat=X&lon=Y
 * Finds nearby agricultural stores using OpenStreetMap Overpass API.
 */
router.get('/stores', weatherRateLimit, async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!isValidCoord(lat, -90, 90) || !isValidCoord(lon, -180, 180)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing lat/lon. Example: /api/stores?lat=19.87&lon=75.34',
      });
    }

    // Overpass QL query: search for agrochemical, farm shops, or marketplace within 20km
    const overpassQuery = `
      [out:json][timeout:10];
      (
        node["shop"="agrochemical"](around:20000,${lat},${lon});
        node["shop"="farm"](around:20000,${lat},${lon});
        node["shop"="garden_centre"](around:20000,${lat},${lon});
        node["amenity"="marketplace"](around:20000,${lat},${lon});
      );
      out body 5;
    `;

    // H2: hard timeout + mirror failover — the main Overpass instance is
    // often rate-limited (406) or congested (504); the mirrors share the
    // load. kumi.systems is official; private.coffee is a well-known
    // community instance. 20s windows: Overpass radius queries are slow.
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
    ];
    let response = null;
    let lastErr = null;
    for (const endpoint of endpoints) {
      try {
        const attempt = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'KisanMitra/1.0 (Contact: admin@kisanmitra.local)'
          },
          body: 'data=' + encodeURIComponent(overpassQuery),
          signal: AbortSignal.timeout(20_000),
        });
        if (attempt.ok) {
          response = attempt;
          break;
        }
        lastErr = new Error(`Overpass API error: ${attempt.status}`);
      } catch (err) {
        lastErr = err;
      }
    }
    if (!response) throw lastErr || new Error('Overpass unavailable');

    const data = await response.json();
    
    // Map to a cleaner format
    const stores = (data.elements || []).map(el => ({
      id: el.id,
      name: el.tags?.name || el.tags?.['name:en'] || 'Local Agricultural Store',
      type: el.tags?.shop || el.tags?.amenity || 'Store',
      lat: el.lat,
      lon: el.lon,
      distance: calculateDistance(parseFloat(lat), parseFloat(lon), el.lat, el.lon)
    })).sort((a, b) => a.distance - b.distance);

    return res.json({ success: true, stores });
  } catch (err) {
    console.error('❌ Store locator error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch stores' });
  }
});

// Numeric validation so untrusted query params can never reach the Overpass QL query
function isValidCoord(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

// Haversine distance formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km (number — formatting is the UI's job) (L7)
}

module.exports = router;
