/**
 * Firebase Service — Kisan Mitra
 *
 * Initialises firebase-admin and exposes Firestore for scan history.
 * Gracefully degrades if Firebase is not configured (returns null).
 */

const adminRaw = require('firebase-admin');
// Handle both CJS and ESM-style package shapes — some installs expose the
// SDK under `.default`, and calling `.credential` on the wrong shape is a
// silent crash ("Cannot read properties of undefined (reading
// 'applicationDefault')") that disabled scan history.
const admin = adminRaw.default ?? adminRaw;

let db = null;
let isInitialized = false;

/**
 * True only when Firestore is usable: a REAL (non-placeholder) project id
 * is set AND the SDK initialised. The default .env ships
 * "your_firebase_project_id" — treating that as configured caused every
 * scan save to silently no-op.
 */
function isFirebaseConfigured() {
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  if (!projectId || /^your[_-]?/i.test(projectId)) return false;
  return getDb() !== null;
}

/**
 * Initialise Firebase Admin SDK.
 * Called once on first use. Returns the Firestore instance or null.
 */
function getDb() {
  if (isInitialized) return db;
  isInitialized = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('⚠️ FIREBASE_PROJECT_ID not set — scan history disabled.');
    return null;
  }

  try {
    // Try service account file first, fall back to application default credentials
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    let credential;

    if (serviceAccountPath) {
      try {
        const serviceAccount = require(serviceAccountPath);
        credential = admin.credential.cert(serviceAccount);
      } catch {
        // Service account file not found — use default credentials
        credential = admin.credential.applicationDefault();
      }
    } else {
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({ credential, projectId });
    db = admin.firestore();
    console.log('🔥 Firebase Firestore initialised successfully.');
    return db;
  } catch (err) {
    console.warn('⚠️ Firebase init failed:', err.message);
    return null;
  }
}

/**
 * Save a diagnosis scan to Firestore.
 * @param {Object} scan — { diagnosis, timestamp, location? }
 * @returns {string|null} — document ID or null if Firebase unavailable
 */
async function saveScan(scan) {
  const firestore = getDb();
  if (!firestore) return null;

  try {
    const docRef = await firestore.collection('scans').add({
      ...scan,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error('❌ Failed to save scan:', err.message);
    return null;
  }
}

/**
 * Retrieve recent scans from Firestore.
 * @param {number} limit — max number of scans to return
 * @param {string|null} deviceId — when set, only scans saved by this device are returned
 * @returns {Array} — array of scan objects
 */
async function getRecentScans(limit = 20, deviceId = null, profileId = null) {
  const firestore = getDb();
  if (!firestore) return [];

  try {
    let query = firestore.collection('scans');
    // H5: filter server-side. Filtering client-side AFTER limit() returned
    // fewer rows than the user's own scans, so profile history under-fetched.
    if (profileId) {
      query = query.where('profileId', '==', profileId);
    } else if (deviceId) {
      // Requires the automatic single-field index on deviceId + manual ordering
      query = query.where('deviceId', '==', deviceId);
    }
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to ISO string
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));
  } catch (err) {
    // Return null (not []) so callers can distinguish "read failed, try
    // another store" from "genuinely empty history".
    console.error('❌ Failed to fetch scans:', err.message);
    return null;
  }
}

module.exports = { isFirebaseConfigured, saveScan, getRecentScans };
