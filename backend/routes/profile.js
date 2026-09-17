// backend/routes/profile.js
// POST /api/profile/login  — { phone, name? } → login-or-register
// GET  /api/profile?phone= — hydrate a saved session (profile by phone)
//
// Identity is the phone number; the name is the display label. Scans are
// tagged with the same profile id by /api/history.

const express = require('express');
const { loginOrRegister, getByPhone } = require('../services/profileStore');
const router = express.Router();

router.post('/profile/login', (req, res) => {
  try {
    const { phone, name } = req.body || {};
    const profile = loginOrRegister(phone, name);
    return res.json({ success: true, profile });
  } catch (err) {
    if (err.code === 'INVALID_PHONE') {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err.code === 'NAME_REQUIRED') {
      // 409 tells the frontend: show the name field and retry
      return res.status(409).json({ success: false, error: err.message, nameRequired: true });
    }
    console.error('❌ Profile login error:', err.message);
    return res.status(500).json({ success: false, error: 'Could not sign you in. Please try again.' });
  }
});

router.get('/profile', (req, res) => {
  const profile = getByPhone(req.query.phone);
  if (!profile) {
    return res.status(404).json({ success: false, error: 'No profile found for this phone.' });
  }
  return res.json({ success: true, profile });
});

module.exports = router;
