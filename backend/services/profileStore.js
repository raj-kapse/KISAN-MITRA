/**
 * Profile Service — Kisan Mitra
 *
 * Lightweight farmer profiles: { name, phone } — no passwords (a phone
 * number is the identity, the name is the display). Profiles are stored
 * locally in backend/data/profiles.json (bounded) with a Firestore path
 * available when real credentials exist.
 *
 * Login flow: POST a phone → if known, return the profile (login);
 * if unknown, create it with the provided name (register).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Operational 1: a random per-boot secret silently invalidated every login
// after a restart (profiles.json persists → farmers locked out with 401).
// When PROFILE_AUTH_SECRET is unset, derive a STABLE secret from the profiles
// file path + FIREBASE_PROJECT_ID so sessions survive reboots. Never printed.
// KISAN_DATA_DIR lets tests point the store at a temp directory instead of the
// real backend/data — running the test suite must never touch farmer data.
const DATA_DIR = process.env.KISAN_DATA_DIR || path.join(__dirname, '..', 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

const PROFILE_AUTH_SECRET = process.env.PROFILE_AUTH_SECRET ||
  (() => {
    console.warn('⚠️  PROFILE_AUTH_SECRET is not set — deriving a stable fallback secret.');
    console.warn('   Set PROFILE_AUTH_SECRET explicitly in production (backend/.env).');
    return crypto
      .createHash('sha256')
      .update(`${PROFILES_FILE}|${process.env.FIREBASE_PROJECT_ID || ''}`)
      .digest('hex');
  })();

// Bounded demo-tier store
const MAX_PROFILES = 500;

/** Normalise an Indian phone number to its last 10 digits for matching. */
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function readProfiles() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    return Array.isArray(parsed.profiles) ? parsed.profiles : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${PROFILES_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ profiles }, null, 2));
  fs.renameSync(tmp, PROFILES_FILE);
}

/**
 * Login-or-register by phone. Returns { id, name, phone, createdAt, isNew }.
 * `name` is required only when the phone is new.
 */
function createProfileToken(profile) {
  const payload = Buffer.from(JSON.stringify({
    id: profile.id,
    phone: profile.phone,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', PROFILE_AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyProfileToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', PROFILE_AUTH_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.id || !data.phone || data.exp < Date.now()) return null;
    const profile = readProfiles().find((item) => item.id === data.id && item.phone === data.phone);
    return profile ? { id: profile.id, phone: profile.phone, name: profile.name } : null;
  } catch {
    return null;
  }
}

function loginOrRegister(rawPhone, rawName, authToken) {
  const phone = normalisePhone(rawPhone);
  if (!phone) {
    const err = new Error('Enter a valid 10-digit phone number.');
    err.code = 'INVALID_PHONE';
    throw err;
  }

  const profiles = readProfiles();
  const existing = profiles.find((p) => p.phone === phone);

  if (existing) {
    const authenticated = verifyProfileToken(authToken);
    if (!authenticated || authenticated.id !== existing.id) {
      const err = new Error('This phone is already registered. Use the same device session to sign in.');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }
    // Known phone → login. A NEW name in the request updates the display name.
    const name = (rawName || '').trim().slice(0, 60) || existing.name;
    existing.name = name;
    existing.lastLoginAt = new Date().toISOString();
    writeProfiles(profiles);
    return { ...existing, token: createProfileToken(existing), isNew: false };
  }

  // New phone → register (name required)
  const name = (rawName || '').trim().slice(0, 60);
  if (!name) {
    const err = new Error('This phone number is new — please also enter your name.');
    err.code = 'NAME_REQUIRED';
    throw err;
  }

  const profile = {
    id: `farmer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    phone,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  profiles.unshift(profile);
  writeProfiles(profiles.slice(0, MAX_PROFILES));
  return { ...profile, token: createProfileToken(profile), isNew: true };
}

/** Look up a profile by phone (used to hydrate a saved session). */
function getByPhone(rawPhone) {
  const phone = normalisePhone(rawPhone);
  if (!phone) return null;
  return readProfiles().find((p) => p.phone === phone) || null;
}

module.exports = { loginOrRegister, getByPhone, verifyProfileToken };
