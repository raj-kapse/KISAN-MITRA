/**
 * Scan Store — Kisan Mitra
 *
 * Persists scan diagnoses with a two-tier strategy:
 *   1. Firestore (via services/firebase.js) when real credentials are configured
 *   2. Local JSON file (backend/data/scans.json) otherwise — so scan history
 *      works with zero Firebase setup (hackathon / local demo mode)
 *
 * The fallback file keeps a bounded number of most-recent scans (per device)
 * and is written atomically. The route/response contract is unchanged.
 */

const fs = require('fs');
const path = require('path');
const { isFirebaseConfigured, saveScan: saveToFirestore, getRecentScans: getFromFirestore } = require('./firebase');

// KISAN_DATA_DIR lets tests (and multi-instance deployments) point the local
// store somewhere else. It MUST be honoured before any file is touched — the
// test suite previously wrote to (and then deleted) the real store.
const DATA_DIR = process.env.KISAN_DATA_DIR || path.join(__dirname, '..', 'data');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');

// Bounded store: keep the N most recent scans overall (the file is a demo-tier
// store, not a database). 500 scans ≈ tens of KB.
const MAX_SCANS = 500;

function isFirebaseReady() {
  try {
    return isFirebaseConfigured();
  } catch {
    return false;
  }
}

function readScans() {
  try {
    const raw = fs.readFileSync(SCANS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.scans) ? parsed.scans : [];
  } catch {
    return [];
  }
}

function writeScans(scans) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Atomic-ish write: temp file then rename, so a crash mid-write can't
  // corrupt the store.
  const tmp = `${SCANS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ scans }, null, 2));
  fs.renameSync(tmp, SCANS_FILE);
}

/**
 * Persist a scan. Returns a document id (Firestore) or a local id
 * (`local-...`) — null only if every tier failed.
 * @param {Object} scan — { diagnosis, timestamp, location?, deviceId? }
 */
async function saveScan(scan) {
  // Tier 1: Firestore, when actually usable
  if (isFirebaseReady()) {
    const docId = await saveToFirestore(scan);
    if (docId) return docId;
    // Firestore configured but the write failed — fall through to local
    console.warn('⚠️ Firestore write failed — falling back to local scan store');
  }

  // Tier 2: local file
  try {
    const scans = readScans();
    const entry = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...scan,
      createdAt: scan.timestamp || new Date().toISOString(),
    };
    scans.unshift(entry);
    // Trim to MAX_SCANS total (M2): the old code kept up to MAX + MAX/10
    // entries because the two slices were concatenated. Keep the newest
    // 50 device-tagged scans plus the newest remainder, but never exceed
    // the cap.
    const withDevice = scans.filter(s => s.deviceId);
    const withoutDevice = scans.filter(s => !s.deviceId);
    const keptWithDevice = withDevice.slice(0, Math.floor(MAX_SCANS * 0.9));
    const kept = [...keptWithDevice, ...withoutDevice.slice(0, MAX_SCANS - keptWithDevice.length)];
    writeScans(kept);
    return entry.id;
  } catch (err) {
    console.error('❌ Local scan store write failed:', err.message);
    return null;
  }
}

/**
 * Retrieve recent scans, newest first. When deviceId is set, only that
 * device's scans are returned (same semantics as the Firestore path).
 * profileId, when set, scopes results to one farmer's history instead.
 */
async function getRecentScans(limit = 20, deviceId = null, profileId = null) {
  if (isFirebaseReady()) {
    const scans = await getFromFirestore(limit, deviceId, profileId);
    if (scans !== null) {
      return scans; // profile/device filtering now happens server-side (H5)
    }
    console.warn('⚠️ Firestore read failed — falling back to local scan store');
  }

  let scans = readScans();
  if (profileId) {
    scans = scans.filter(s => s.profileId === profileId);
  } else if (deviceId) {
    scans = scans.filter(s => s.deviceId === deviceId);
  }
  return scans
    .slice(0, limit)
    .map(s => ({ ...s, createdAt: s.createdAt || s.timestamp || null }));
}

module.exports = { saveScan, getRecentScans };
