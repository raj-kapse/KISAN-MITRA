const express = require('express');
const router = express.Router();

/**
 * GET /api/stores?lat=X&lon=Y
 * Finds nearby agricultural stores using OpenStreetMap Overpass API.
 */
router.get('/stores', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, error: 'Missing lat/lon' });
    }

    // Overpass QL query: search for agrochemical, farm shops, or marketplace within 10km (10000m)
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

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'data=' + encodeURIComponent(overpassQuery)
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

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

// Haversine distance formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}

module.exports = router;
