// RustWasmAssetLoader (P0-C 第 1 项) 与 buildRustWasmAsset 脚本的契约测试。

const assert = require('node:assert');
const { test } = require('node:test');
const path = require('path');
const {
  ASSET_REASONS,
  DEFAULT_REQUIRED_EXPORTS,
  RustWasmAssetError,
  assertManifestShape,
  assertRequiredExports,
  computeSha256,
  loadRustWasmAsset
} = require('../src/rustWasmAsset');
const {
  parseCrateVersion,
  PROTOCOL_VERSION,
  REQUIRED_EXPORTS,
  TARGET_TRIPLE
} = require('../scripts/buildRustWasmAsset');

const VALID_MANIFEST = {
  protocolVersion: PROTOCOL_VERSION,
  crateVersion: '0.1.0',
  targetTriple: TARGET_TRIPLE,
  wasmPath: 'syntec_core.wasm',
  byteLength: 4,
  sha256: computeSha256(Buffer.from('\0\0\0\0')),
  exports: [...REQUIRED_EXPORTS],
  abiFlags: { requestAbi: true, legacyTextAbi: true, formatDocument: true },
  builtAt: '2026-09-20T00:00:00.000Z'
};

test('computeSha256 returns lowercase hex sha256', () => {
  const hash = computeSha256(Buffer.from(''));
  assert.strictEqual(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('assertManifestShape validates a well-formed manifest', () => {
  assert.deepStrictEqual(
    assertManifestShape({ ...VALID_MANIFEST }),
    { ...VALID_MANIFEST }
  );
});

test('assertManifestShape rejects missing required fields', () => {
  const requiredFields = [
    'protocolVersion',
    'crateVersion',
    'targetTriple',
    'wasmPath',
    'byteLength',
    'sha256',
    'exports'
  ];
  for (const key of requiredFields) {
    const clone = { ...VALID_MANIFEST };
    delete clone[key];
    assert.throws(
      () => assertManifestShape(clone),
      (/** @type {unknown} */ err) => {
        assert.ok(err instanceof RustWasmAssetError);
        assert.strictEqual(err.reason, ASSET_REASONS.MANIFEST_INVALID);
        return true;
      }
    );
  }
  // optional fields (builtAt, abiFlags) can be omitted without error
  const minimal = { ...VALID_MANIFEST };
  delete minimal.builtAt;
  delete minimal.abiFlags;
  assert.ok(assertManifestShape(minimal));
});

test('assertManifestShape rejects malformed sha256 and exports', () => {
  assert.throws(
    () => assertManifestShape({ ...VALID_MANIFEST, sha256: 'XYZ' }),
    /sha256 must be a 64-character lowercase hex string/
  );
  assert.throws(
    () => assertManifestShape({ ...VALID_MANIFEST, exports: [] }),
    /manifest.exports must be a non-empty array/
  );
  assert.throws(
    () => assertManifestShape({ ...VALID_MANIFEST, exports: ['memory', 7] }),
    /manifest.exports entries must be non-empty strings/
  );
  assert.throws(
    () => assertManifestShape({ ...VALID_MANIFEST, abiFlags: 'oops' }),
    /manifest.abiFlags must be an object/
  );
});

test('assertManifestShape enforces required subset when exports superset is larger', () => {
  const manifest = assertManifestShape({
    ...VALID_MANIFEST,
    exports: [...REQUIRED_EXPORTS, 'syntec_core_extra_probe']
  });
  assert.ok(manifest.exports.length === REQUIRED_EXPORTS.length + 1);
  // missing one of the required subset must fail
  const missing = [...REQUIRED_EXPORTS].slice(1);
  assert.throws(
    () => assertManifestShape({ ...VALID_MANIFEST, exports: missing }),
    /manifest.exports is missing required export/
  );
});

test('assertRequiredExports lists missing exports', () => {
  const wasmExports = { memory: {}, syntec_core_alloc: {}, syntec_core_dealloc: {} };
  let caught;
  try {
    assertRequiredExports(wasmExports, DEFAULT_REQUIRED_EXPORTS);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof RustWasmAssetError);
  assert.strictEqual(caught.reason, ASSET_REASONS.EXPORTS_MISMATCH);
  assert.match(caught.message, /syntec_core_free_output/);
});

function createFakeInstantiator(exportsName, exports) {
  const instance = { exports: Object.fromEntries(exportsName.map(name => [name, exports[name] || (() => {})])) };
  return async () => instance;
}

async function writeTempProject(tmp, manifest, bytes, instantiator) {
  const fs = require('fs');
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, manifest.wasmPath), bytes);
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(manifest));
  return loadRustWasmAsset(path.join(tmp, 'manifest.json'), {
    instantiator,
    requiredExports: manifest.exports
  });
}

test('loadRustWasmAsset successfully loads a valid asset', async () => {
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-wasm-asset-'));
  const bytes = Buffer.alloc(16, 0xab);
  const manifest = {
    ...VALID_MANIFEST,
    byteLength: bytes.length,
    sha256: computeSha256(bytes)
  };
  const { manifest: loaded, bytes: loadedBytes } = await writeTempProject(
    tmp,
    manifest,
    bytes,
    createFakeInstantiator(manifest.exports, {})
  );
  assert.strictEqual(loaded.sha256, manifest.sha256);
  assert.strictEqual(loadedBytes.length, bytes.length);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadRustWasmAsset fails when the manifest file is missing', async () => {
  await assert.rejects(
    () => loadRustWasmAsset(path.join('__does_not_exist__', 'manifest.json')),
    (err) => {
      assert.ok(err instanceof RustWasmAssetError);
      assert.strictEqual(err.reason, ASSET_REASONS.MANIFEST_MISSING);
      return true;
    }
  );
});

test('loadRustWasmAsset fails when manifest is invalid JSON', async () => {
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-wasm-asset-'));
  const manifestPath = path.join(tmp, 'manifest.json');
  fs.writeFileSync(manifestPath, '{ not json');
  await assert.rejects(
    () => loadRustWasmAsset(manifestPath),
    (err) => {
      assert.ok(err instanceof RustWasmAssetError);
      assert.strictEqual(err.reason, ASSET_REASONS.MANIFEST_INVALID);
      return true;
    }
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadRustWasmAsset fails when the wasm byte length does not match', async () => {
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-wasm-asset-'));
  const bytes = Buffer.alloc(8, 0xc1);
  const manifest = {
    ...VALID_MANIFEST,
    byteLength: bytes.length + 1, // mismatch
    sha256: computeSha256(bytes)
  };
  await assert.rejects(
    () => writeTempProject(tmp, manifest, bytes, createFakeInstantiator(manifest.exports, {})),
    (err) => {
      assert.ok(err instanceof RustWasmAssetError);
      assert.strictEqual(err.reason, ASSET_REASONS.WASM_BYTES_MISMATCH);
      return true;
    }
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadRustWasmAsset fails when SHA-256 differs', async () => {
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-wasm-asset-'));
  const bytes = Buffer.alloc(8, 0xee);
  const manifest = {
    ...VALID_MANIFEST,
    byteLength: bytes.length,
    sha256: '0'.repeat(64) // wrong
  };
  await assert.rejects(
    () => writeTempProject(tmp, manifest, bytes, createFakeInstantiator(manifest.exports, {})),
    (err) => {
      assert.ok(err instanceof RustWasmAssetError);
      assert.strictEqual(err.reason, ASSET_REASONS.WASM_SHA_MISMATCH);
      return true;
    }
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadRustWasmAsset fails when instantiation throws', async () => {
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-wasm-asset-'));
  const bytes = Buffer.alloc(4, 0xdd);
  const manifest = {
    ...VALID_MANIFEST,
    byteLength: bytes.length,
    sha256: computeSha256(bytes)
  };
  const failingInstantiator = async () => { throw new TypeError('compile error'); };
  await assert.rejects(
    () => writeTempProject(tmp, manifest, bytes, failingInstantiator),
    (err) => {
      assert.ok(err instanceof RustWasmAssetError);
      assert.strictEqual(err.reason, ASSET_REASONS.WASM_INSTANTIATION_FAILED);
      return true;
    }
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadRustWasmAsset fails when exports are missing', async () => {
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-wasm-asset-'));
  const bytes = Buffer.alloc(2, 0xa5);
  const manifest = {
    ...VALID_MANIFEST,
    byteLength: bytes.length,
    sha256: computeSha256(bytes)
  };
  // instantiate returns only `memory`, missing every other required export.
  const instantiator = async () => ({ exports: { memory: {} } });
  await assert.rejects(
    () => writeTempProject(tmp, manifest, bytes, instantiator),
    (err) => {
      assert.ok(err instanceof RustWasmAssetError);
      assert.strictEqual(err.reason, ASSET_REASONS.EXPORTS_MISMATCH);
      return true;
    }
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadRustWasmAsset fails when wasmPath does not exist', async () => {
  const os = require('os');
  const fs = require('fs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-wasm-asset-'));
  const manifestPath = path.join(tmp, 'manifest.json');
  const manifest = { ...VALID_MANIFEST };
  // we deliberately do not write the wasm bytes
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  await assert.rejects(
    () => loadRustWasmAsset(manifestPath, {
      requiredExports: manifest.exports
    }),
    (err) => {
      assert.ok(err instanceof RustWasmAssetError);
      assert.strictEqual(err.reason, ASSET_REASONS.WASM_PATH_MISSING);
      return true;
    }
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('parseCrateVersion extracts Cargo.toml version', () => {
  const sample = [
    '[package]',
    'name = "syntec-core"',
    'version = "0.1.0"',
    'edition = "2021"'
  ].join('\n');
  assert.strictEqual(parseCrateVersion(sample), '0.1.0');
  assert.throws(() => parseCrateVersion('no version here'), /version/);
});

test('buildManifestData returns consistent manifest from source wasm', () => {
  const { buildManifestData, DEFAULT_SOURCE_WASM } = require('../scripts/buildRustWasmAsset');
  if (!require('fs').existsSync(DEFAULT_SOURCE_WASM)) {
    // 本机若未构建 wasm 资产（CI matrix 未覆盖该平台）则跳过本测试，
    // 避免强制耦合 build target。buildRustWasmAsset --check 由
    // check:rust:wasm:asset 任务做实际完整性校验。
    return;
  }
  const { manifest, bytes } = buildManifestData();
  assert.strictEqual(manifest.protocolVersion, PROTOCOL_VERSION);
  assert.strictEqual(manifest.targetTriple, TARGET_TRIPLE);
  assert.strictEqual(manifest.byteLength, bytes.length);
  assert.strictEqual(manifest.sha256, computeSha256(bytes));
  for (const name of REQUIRED_EXPORTS) {
    assert.ok(manifest.exports.includes(name), `manifest.exports should include ${name}`);
  }
});
