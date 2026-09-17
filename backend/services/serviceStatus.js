/**
 * Service status — Kisan Mitra
 *
 * Single source of truth for "is this env value actually usable?".
 *
 * `.env.example` ships placeholders ("your_groq_api_key_here",
 * "replace_with_a_long_random_secret") and the documented setup step is to copy
 * it and fill in the real values. A bare `!!process.env.X` test treats a
 * placeholder as configured, which made:
 *
 *   - the boot log print "✅ Set" for keys that could never work,
 *   - /api/health report "ready" while every call failed,
 *   - PROFILE_AUTH_SECRET accept a value published in this repository as the
 *     HMAC key for session tokens (anyone could forge a session).
 *
 * Every caller goes through here so those three can't drift apart again.
 */

// A value is a placeholder if it still looks like the shipped template text.
const PLACEHOLDER_PATTERN = /^(your[_-]|replace[_-]?with|change[_-]?me|placeholder|xxx)/i;

/**
 * True when the value is a real, non-empty, non-placeholder configuration.
 * @param {string|undefined} value
 * @returns {boolean}
 */
function isConfigured(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERN.test(trimmed);
}

// Each check reads the environment at call time (not import time) so tests and
// callers can reason about a specific env without module-cache surprises.
const CHECKS = {
  gemini: () => isConfigured(process.env.GEMINI_API_KEY),
  groq: () => isConfigured(process.env.GROQ_API_KEY),
  openweather: () => isConfigured(process.env.OPENWEATHER_API_KEY),
  firebaseProject: () => isConfigured(process.env.FIREBASE_PROJECT_ID),
  profileSecret: () => isConfigured(process.env.PROFILE_AUTH_SECRET),
};

/**
 * @param {'gemini'|'groq'|'openweather'|'firebaseProject'|'profileSecret'} name
 * @returns {boolean}
 */
function isServiceConfigured(name) {
  return CHECKS[name] ? CHECKS[name]() : false;
}

/**
 * Human-readable state for the boot log: never leaks the value itself.
 * @param {string|undefined} value
 * @returns {'missing'|'placeholder'|'set'}
 */
function describeValue(value) {
  if (!value || !value.trim()) return 'missing';
  return isConfigured(value) ? 'set' : 'placeholder';
}

module.exports = { isConfigured, isServiceConfigured, describeValue };
