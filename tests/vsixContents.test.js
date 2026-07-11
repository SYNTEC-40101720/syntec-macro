const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkVsixContents, normalizeFiles } = require('../scripts/checkVsixContents');
const { getVsixArtifactSummary } = require('../scripts/reportVsixArtifact');

const required = ['README.md', 'package.json', 'src/extension.js'];

test('VSIX content check accepts an exact required file list', () => {
  assert.deepStrictEqual(checkVsixContents(required, required), []);
  assert.deepStrictEqual(normalizeFiles(['src\\extension.js', '', ' README.md ']), [
    'src/extension.js',
    'README.md'
  ]);
});

test('VSIX content check reports missing and unexpected files', () => {
  assert.deepStrictEqual(
    checkVsixContents(['README.md', 'scripts/build.js'], required),
    [
      'Required VSIX file is missing: package.json',
      'Required VSIX file is missing: src/extension.js',
      'Unexpected VSIX file: scripts/build.js'
    ]
  );
});

test('VSIX content check reports duplicate entries', () => {
  assert.deepStrictEqual(
    checkVsixContents([...required, 'README.md'], required),
    ['VSIX file list contains duplicate entries.']
  );
});

test('VSIX artifact summary reports byte size and SHA-256', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'syntec-vsix-'));
  const artifactPath = path.join(tempDirectory, 'sample.vsix');
  try {
    fs.writeFileSync(artifactPath, 'abc', 'utf8');
    assert.deepStrictEqual(getVsixArtifactSummary(artifactPath), {
      fileName: 'sample.vsix',
      sizeBytes: 3,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    });
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});