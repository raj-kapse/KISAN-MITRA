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

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

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
function loginOrRegister(rawPhone, rawName) {
  const phone = normalisePhone(rawPhone);
  if (!phone) {
    const err = new Error('Enter a valid 10-digit phone number.');
    err.code = 'INVALID_PHONE';
    throw err;
  }

  const profiles = readProfiles();
  const existing = profiles.find((p) => p.phone === phone);

  if (existing) {
    // Known phone → login. A NEW name in the request updates the display name.
    const name = (rawName || '').trim().slice(0, 60) || existing.name;
    existing.name = name;
    existing.lastLoginAt = new Date().toISOString();
    writeProfiles(profiles);
    return { ...existing, isNew: false };
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
  return { ...profile, isNew: true };
}

/** Look up a profile by phone (used to hydrate a saved session). */
function getByPhone(rawPhone) {
  const phone = normalisePhone(rawPhone);
  if (!phone) return null;
  return readProfiles().find((p) => p.phone === phone) || null;
}

module.exports = { loginOrRegister, getByPhone };
