/**
 * Health check route — verifies backend is alive and API keys are configured.
 * Used by the frontend to confirm connectivity during Phase 1.
 */

const express = require('express');
const { isFirebaseConfigured } = require('../services/firebase');
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
      // Ask the real readiness check, not just "is the env var set": the
      // default .env ships a placeholder project id that firebase.js
      // deliberately ignores, so a presence check reported "ready" while
      // scans were silently going to the local JSON store.
      firebase: (() => {
        const ready = isFirebaseConfigured();
        return {
          configured: ready,
          status: ready ? 'ready' : 'local_store',
          detail: ready ? undefined : 'Scan history is using the local JSON store.',
        };
      })(),
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
