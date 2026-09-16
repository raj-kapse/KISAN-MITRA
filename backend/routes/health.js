/**
 * Health check route — verifies backend is alive and API keys are configured.
 * Used by the frontend to confirm connectivity during Phase 1.
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * Returns server status and configuration check for all required services.
 */
router.get('/health', (req, res) => {
  const status = {
    success: true,
    message: '🌾 Kisan Mitra backend is running',
    timestamp: new Date().toISOString(),
    services: {
      gemini: {
        configured: !!process.env.GEMINI_API_KEY,
        status: process.env.GEMINI_API_KEY ? 'ready' : 'missing_key',
      },
      groq: {
        configured: !!process.env.GROQ_API_KEY,
        status: process.env.GROQ_API_KEY ? 'ready' : 'missing_key',
      },
      openweather: {
        configured: !!process.env.OPENWEATHER_API_KEY,
        status: process.env.OPENWEATHER_API_KEY ? 'ready' : 'missing_key',
      },
      firebase: {
        configured: !!process.env.FIREBASE_PROJECT_ID,
        status: process.env.FIREBASE_PROJECT_ID ? 'ready' : 'missing_key',
      },
    },
  };

  res.json(status);
});

/**
 * GET /api/ping
 * Minimal latency check — just returns "pong".
 */
router.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

module.exports = router;
