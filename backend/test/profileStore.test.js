/**
 * Profile store tests.
 *
 * SAFETY: KISAN_DATA_DIR is pointed at a fresh temp directory BEFORE the store
 * is required, so these tests can never read, overwrite or delete the real
 * backend/data store. An earlier version of this file wrote a "Test Farmer"
 * profile into the real store and then `rmSync`d it — running `npm test`
 * signed out and wiped every farmer profile. Never point this at the real
 * data directory.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kisan-profile-test-'));
process.env.KISAN_DATA_DIR = tmpDir;

const REAL_DATA_FILE = path.join(__dirname, '..', 'data', 'profiles.json');
const TEST_DATA_FILE = path.join(tmpDir, 'profiles.json');
const realStoreBefore = fs.existsSync(REAL_DATA_FILE)
  ? fs.readFileSync(REAL_DATA_FILE, 'utf8')
  : null;

const { loginOrRegister, verifyProfileToken } = require('../services/profileStore');

test('profile tokens authorize the profile that created them', () => {
  const phone = `9${Date.now().toString().slice(-9)}`;
  const profile = loginOrRegister(phone, 'Test Farmer');

  assert.equal(profile.isNew, true);
  assert.equal(verifyProfileToken(profile.token).id, profile.id);
  assert.equal(verifyProfileToken(`${profile.token}tampered`), null);
  assert.throws(
    () => loginOrRegister(phone, 'Attacker'),
    (error) => error.code === 'AUTH_REQUIRED'
  );

  // The test wrote to the temp store, not the real one
  assert.ok(fs.existsSync(TEST_DATA_FILE), 'expected the temp store to be written');
});

test('verification rejects malformed and unsigned tokens', () => {
  assert.equal(verifyProfileToken(null), null);
  assert.equal(verifyProfileToken(''), null);
  assert.equal(verifyProfileToken('not-a-token'), null);
  assert.equal(verifyProfileToken('payload.signature'), null);
  // A valid-looking payload signed with the wrong key must not authorize
  const forged = Buffer.from(
    JSON.stringify({ id: 'farmer-forged', phone: '9999999999', exp: Date.now() + 86400000 })
  ).toString('base64url');
  assert.equal(verifyProfileToken(`${forged}.deadbeef`), null);
});

test('a known phone cannot be claimed from a new device session', () => {
  const phone = `8${Date.now().toString().slice(-9)}`;
  const owner = loginOrRegister(phone, 'Owner');

  // Second device: no token → must be refused, not logged in
  assert.throws(
    () => loginOrRegister(phone, 'Imposter'),
    (error) => error.code === 'AUTH_REQUIRED'
  );

  // Same device session (valid token) → allowed, and classified as a login
  const again = loginOrRegister(phone, undefined, owner.token);
  assert.equal(again.isNew, false);
  assert.equal(again.id, owner.id);
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Regression guard: the real store must be byte-identical after the suite
  const realStoreAfter = fs.existsSync(REAL_DATA_FILE)
    ? fs.readFileSync(REAL_DATA_FILE, 'utf8')
    : null;
  assert.equal(
    realStoreAfter,
    realStoreBefore,
    'the test suite modified the REAL profile store at backend/data/profiles.json'
  );
});
