/**
 * Firebase Service — Kisan Mitra
 *
 * Initialises firebase-admin and exposes Firestore for scan history.
 * Gracefully degrades if Firebase is not configured (returns null).
 */

const admin = require('firebase-admin');

let db = null;
let isInitialized = false;

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
async function getRecentScans(limit = 20, deviceId = null) {
  const firestore = getDb();
  if (!firestore) return [];

  try {
    let query = firestore.collection('scans');
    if (deviceId) {
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
    console.error('❌ Failed to fetch scans:', err.message);
    return [];
  }
}

module.exports = { saveScan, getRecentScans };
