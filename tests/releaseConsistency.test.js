const { test } = require('node:test');
const assert = require('node:assert');
const { checkReleaseConsistency, parseReleaseTag } = require('../scripts/checkReleaseConsistency');

function createInput(overrides = {}) {
  return {
    packageJson: { version: '2.10.0' },
    packageLock: { version: '2.10.0', packages: { '': { version: '2.10.0' } } },
    readme: '![Version](https://img.shields.io/badge/version-2.10.0-blue)',
    changelog: '## [2.10.0] - 2026-07-11\n\n### Added\n- Feature',
    ...overrides
  };
}

test('Release consistency accepts matching package, badge, changelog, and tag', () => {
  assert.deepStrictEqual(checkReleaseConsistency(createInput({ releaseTag: 'v2.10.0' })), []);
  assert.strictEqual(parseReleaseTag('v2.10.0'), '2.10.0');
});

test('Package consistency reports both lockfile version locations', () => {
  const errors = checkReleaseConsistency(createInput({
    packageLock: { version: '2.9.0', packages: { '': { version: '2.8.0' } } }
  }));
  assert.strictEqual(errors.length, 2);
  assert.ok(errors.some(error => error.includes('package-lock.json version 2.9.0')));
  assert.ok(errors.some(error => error.includes('root package version 2.8.0')));
});

test('Package consistency requires an X.Y.Z package version', () => {
  const errors = checkReleaseConsistency(createInput({
    packageJson: { version: '2.10' },
    packageLock: { version: '2.10', packages: { '': { version: '2.10' } } }
  }));
  assert.deepStrictEqual(errors, ['package.json version 2.10 must match X.Y.Z.']);
});

test('Release consistency rejects malformed or mismatched tags', () => {
  assert.deepStrictEqual(
    checkReleaseConsistency(createInput({ releaseTag: '2.10.0' })),
    ['Release tag 2.10.0 must match vX.Y.Z.']
  );
  assert.deepStrictEqual(
    checkReleaseConsistency(createInput({ releaseTag: '' })),
    ['Release tag  must match vX.Y.Z.']
  );
  assert.ok(
    checkReleaseConsistency(createInput({ releaseTag: 'v2.9.0' }))
      .some(error => error.includes('does not match package.json 2.10.0'))
  );
});

test('Release consistency reports README and CHANGELOG mismatches', () => {
  const errors = checkReleaseConsistency(createInput({
    releaseTag: 'v2.10.0',
    readme: 'No version badge',
    changelog: '## [Unreleased]\n'
  }));
  assert.ok(errors.some(error => error.includes('README version badge (missing)')));
  assert.ok(errors.some(error => error.includes('CHANGELOG release section [2.10.0]')));
});