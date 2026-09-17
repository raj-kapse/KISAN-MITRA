const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const dataFile = require('node:path').join(__dirname, '..', 'data', 'profiles.json');
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

  fs.rmSync(dataFile, { force: true });
});
