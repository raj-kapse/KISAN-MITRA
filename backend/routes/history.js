/**
 * History Route — Kisan Mitra
 *
 * GET  /api/history — retrieve past scan diagnoses
 * POST /api/history — save a new scan diagnosis
 */

const express = require('express');
const { saveScan, getRecentScans } = require('../services/firebase');

const router = express.Router();

/**
 * GET /api/history
 * Returns recent scan history from Firestore.
 */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const scans = await getRecentScans(limit);
    return res.json({ success: true, scans });
  } catch (err) {
    console.error('❌ History fetch error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve scan history.',
    });
  }
});

/**
 * POST /api/history
 * Saves a diagnosis scan to Firestore.
 * Body: { diagnosis: {...}, location?: { lat, lon } }
 */
router.post('/history', async (req, res) => {
  try {
    const { diagnosis, location } = req.body;

    if (!diagnosis) {
      return res.status(400).json({
        success: false,
        error: 'Missing diagnosis data in request body.',
      });
    }

    const scanData = {
      diagnosis,
      location: location || null,
      timestamp: new Date().toISOString(),
    };

    const docId = await saveScan(scanData);

    if (docId) {
      return res.json({ success: true, id: docId });
    } else {
      // Firebase not configured — still return success (graceful degradation)
      return res.json({
        success: true,
        id: null,
        note: 'Firebase not configured — scan not persisted.',
      });
    }
  } catch (err) {
    console.error('❌ History save error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to save scan.',
    });
  }
});

module.exports = router;
