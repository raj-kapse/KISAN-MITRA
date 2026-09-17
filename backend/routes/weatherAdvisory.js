const express = require('express');
const router = express.Router();
const { chatComplete } = require('../services/textProvider');
const { advisoryRateLimit } = require('../middleware/rateLimit');

/**
 * POST /api/weather-advisory
 * Requires { diagnosis, weather, lang }
 */
router.post('/weather-advisory', advisoryRateLimit, async (req, res) => {
  try {
    const { diagnosis, weather, lang } = req.body;
    
    if (!diagnosis || !weather) {
      return res.status(400).json({ success: false, error: 'Missing diagnosis or weather data' });
    }

    const langLine = lang === 'hi'
      ? 'Respond strictly in Hindi (Devanagari script).'
      : lang === 'mr'
        ? 'Respond strictly in Marathi (Devanagari script).'
        : 'Respond in English.';
    const { text: advice, provider } = await chatComplete(
      [
        {
          role: 'user',
          content: `You are an expert agricultural advisor for Indian farmers.
The farmer's crop has been diagnosed with: ${diagnosis.disease_name} (${diagnosis.crop_type || 'unknown crop'}).
The current weather is: ${weather.temp}°C, ${weather.description}, humidity ${weather.humidity}%.

Provide exactly 2-3 sentences of critical farming advice combining the disease and the weather. Do not hallucinate. Be direct and actionable. ${langLine}`,
        },
      ],
      'You are Kisan Mitra, an expert agricultural advisor for Indian farmers. Be concise, practical, and truthful.'
    );

    res.json({ success: true, advice, provider });
  } catch (error) {
    console.error('Weather Advisory Error:', error);
    // 503 = provider/quota problem (retryable), 500 = unexpected bug
    const status = error.code === 'PROVIDER_TIMEOUT' || /timed out|429|503/i.test(error.message || '') ? 503 : 500;
    res.status(status).json({
      success: false,
      error: status === 503
        ? 'AI service is busy right now — please try again in a few seconds.'
        : 'Failed to generate combined AI advisory',
    });
  }
});

module.exports = router;
