const express = require('express');
const router = express.Router();
const { generateWeatherAdvisory } = require('../services/gemini');

/**
 * POST /api/weather-advisory
 * Requires { diagnosis, weather, lang }
 */
router.post('/weather-advisory', async (req, res) => {
  try {
    const { diagnosis, weather, lang } = req.body;
    
    if (!diagnosis || !weather) {
      return res.status(400).json({ success: false, error: 'Missing diagnosis or weather data' });
    }

    const advice = await generateWeatherAdvisory(diagnosis, weather, lang || 'en');
    
    res.json({ success: true, advice });
  } catch (error) {
    console.error('Weather Advisory Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate combined AI advisory' });
  }
});

module.exports = router;
