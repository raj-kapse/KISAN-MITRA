/**
 * Service-status tests.
 *
 * These cover the placeholder trap in .env.example: `cp .env.example .env`
 * (the documented setup step) leaves values like "your_groq_api_key_here" and
 * "replace_with_a_long_random_secret" in place. Treating those as configured
 * made the boot log claim the keys were set, /api/health report "ready", and
 * PROFILE_AUTH_SECRET sign session tokens with a value published in this repo.
 */

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  isConfigured,
  isServiceConfigured,
  describeValue,
} = require('../services/serviceStatus');

test('placeholder values are not configuration', () => {
  const unconfigured = [
    undefined,
    null,
    '',
    '   ',
    'your_groq_api_key_here',
    'your_gemini_api_key_here',
    'your_openweathermap_api_key_here',
    'your_firebase_project_id_here',
    'replace_with_a_long_random_secret',
    'YOUR_API_KEY',
    'changeme',
    'placeholder',
  ];
  for (const value of unconfigured) {
    assert.equal(isConfigured(value), false, `expected ${JSON.stringify(value)} to count as unconfigured`);
  }

  const configured = [
    'gsk_0abc123def',
    'AIzaSyD-realistic-key',
    '0123456789abcdef0123456789abcdef',
    'a'.repeat(64),
  ];
  for (const value of configured) {
    assert.equal(isConfigured(value), true, `expected ${JSON.stringify(value)} to count as configured`);
  }
});

test('describeValue separates missing, placeholder and set', () => {
  assert.equal(describeValue(undefined), 'missing');
  assert.equal(describeValue('  '), 'missing');
  assert.equal(describeValue('your_groq_api_key_here'), 'placeholder');
  assert.equal(describeValue('gsk_real_key'), 'set');
});

test('isServiceConfigured reads the environment at call time', () => {
  const original = process.env.GROQ_API_KEY;
  try {
    delete process.env.GROQ_API_KEY;
    assert.equal(isServiceConfigured('groq'), false);

    process.env.GROQ_API_KEY = 'your_groq_api_key_here';
    assert.equal(isServiceConfigured('groq'), false, 'a placeholder must not count as configured');

    process.env.GROQ_API_KEY = 'gsk_real_key_value';
    assert.equal(isServiceConfigured('groq'), true);
  } finally {
    if (original === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = original;
  }

  assert.equal(isServiceConfigured('not-a-service'), false);
});

/**
 * The security regression: the .env.example secret is public, so a token signed
 * with it must never authorize anything. Runs in a child process because the
 * signing key is resolved once at module load.
 */
test('tokens signed with the .env.example secret are rejected', () => {
  const crypto = require('node:crypto');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kisan-status-test-'));

  const payload = Buffer.from(JSON.stringify({
    id: 'farmer-forged',
    phone: '9999999999',
    exp: Date.now() + 86_400_000,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', 'replace_with_a_long_random_secret')
    .update(payload)
    .digest('base64url');

  const storePath = path.join(__dirname, '..', 'services', 'profileStore.js');
  const script = `const { verifyProfileToken } = require(${JSON.stringify(storePath)});
process.stdout.write(JSON.stringify({ verified: verifyProfileToken(${JSON.stringify(`${payload}.${signature}`)}) }));`;

  const output = execFileSync(process.execPath, ['-e', script], {
    env: {
      ...process.env,
      PROFILE_AUTH_SECRET: 'replace_with_a_long_random_secret',
      KISAN_DATA_DIR: tmpDir,
    },
    encoding: 'utf8',
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.equal(
    JSON.parse(output).verified,
    null,
    'a token signed with the placeholder secret must not verify'
  );
});
