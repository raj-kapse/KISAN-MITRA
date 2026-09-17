/**
 * History Route — Kisan Mitra
 *
 * GET  /api/history — retrieve past scan diagnoses
 * POST /api/history — save a new scan diagnosis
 */

const express = require('express');
const { saveScan, getRecentScans } = require('../services/scanStore');

const router = express.Router();

/**
 * GET /api/history
 * Returns recent scan history from Firestore.
 */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    // Scope priority: logged-in profile → else the calling device
    const deviceId = (req.query.deviceId || '').toString().trim().slice(0, 128) || null;
    const profileId = (req.query.profileId || '').toString().trim().slice(0, 64) || null;
    const scans = await getRecentScans(limit, deviceId, profileId);
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
    const { diagnosis, location, deviceId, profileId, profileName } = req.body;

    if (!diagnosis) {
      return res.status(400).json({
        success: false,
        error: 'Missing diagnosis data in request body.',
      });
    }

    const scanData = {
      diagnosis,
      location: location || null,
      deviceId: typeof deviceId === 'string' ? deviceId.trim().slice(0, 128) : null,
      // Profile attribution (logged-in farmer) — shown in history
      profileId: typeof profileId === 'string' ? profileId.trim().slice(0, 64) : null,
      profileName: typeof profileName === 'string' ? profileName.trim().slice(0, 60) : null,
      timestamp: new Date().toISOString(),
    };

    const docId = await saveScan(scanData);

    if (docId) {
      return res.json({ success: true, id: docId });
    } else {
      // Persistence unavailable on every tier (Firestore unconfigured AND
      // local write failed) — still non-fatal for the scan flow.
      return res.json({
        success: true,
        id: null,
        note: 'Scan could not be persisted (no storage available).',
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
