const { verifyProfileToken } = require('../services/profileStore');

function getBearerToken(req) {
  const value = req.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : null;
}

function requireProfileAuth(req, res, next) {
  const token = getBearerToken(req);
  const profile = verifyProfileToken(token);
  if (!profile) {
    return res.status(401).json({
      success: false,
      error: 'Sign in is required for this profile data.',
    });
  }
  req.profile = profile;
  return next();
}

module.exports = { getBearerToken, requireProfileAuth };
