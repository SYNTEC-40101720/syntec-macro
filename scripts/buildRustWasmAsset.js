// P0-C 第 1 项：从开发态 target/ 构建 Rust Wasm 生产资产 + manifest。
//
// 流程：
// 1. 从 `crates/syntec-core/Cargo.toml` 解析 crate version。
// 2. 读 SOURCE_WASM（默认开发态 target/wasm32-unknown-unknown/release/syntec_core.wasm）。
// 3. 写 ASSET_WASM（默认 assets/rust-wasm/syntec_core.wasm）。
// 4. 生成 manifest.json（protocolVersion、crateVersion、targetTriple、
//    wasmPath、byteLength、sha256、exports、abiFlags、builtAt）。
// 5. `--check` 模式：只校验磁盘上的 manifest 与 wasm bytes 是否一致，
//    不重写；用于 CI 确保资产未被外部改动。
//
//资产目录 `assets/` 当前仍被 `.vscodeignore` 排除——P0-C 第 3 项（Worker
// 接入）完成前不进入 VSIX；本脚本只维护资产与 manifest 的可重现性。

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_REQUIRED_EXPORTS,
  assertManifestShape,
  computeSha256
} = require('../src/rustWasmAsset');

const ROOT = path.resolve(__dirname, '..');
const CARGO_TOML = path.join(ROOT, 'crates', 'syntec-core', 'Cargo.toml');
const DEFAULT_SOURCE_WASM = path.join(
  ROOT,
  'crates',
  'syntec-core',
  'target',
  'wasm32-unknown-unknown',
  'release',
  'syntec_core.wasm'
);
const ASSET_DIR = path.join(ROOT, 'assets', 'rust-wasm');
const DEFAULT_ASSET_WASM = path.join(ASSET_DIR, 'syntec_core.wasm');
const DEFAULT_MANIFEST_PATH = path.join(ASSET_DIR, 'manifest.json');
const TARGET_TRIPLE = 'wasm32-unknown-unknown';
const PROTOCOL_VERSION = 1;
const REQUIRED_EXPORTS = [
  ...DEFAULT_REQUIRED_EXPORTS,
  'syntec_core_analyze_request_json',
  'syntec_core_analyze_json'
];

/**
 * @param {string} cargoTomlText
 * @returns {string}
 */
function parseCrateVersion(cargoTomlText) {
  const match = /^\s*version\s*=\s*"([^"]+)"/m.exec(cargoTomlText);
  if (!match) throw new Error('could not find [package] version in Cargo.toml');
  return match[1];
}

/**
 * 读 Wasm bytes 并返回 manifest 的纯数据结构（不写磁盘）。
 *
 * @param {{sourceWasm?: string, assetWasmName?: string, builtAt?: string}} [options]
 * @returns {{manifest: object, bytes: Buffer, sourcePath: string, assetWasmName: string}}
 */
function buildManifestData(options = {}) {
  const sourcePath = options.sourceWasm || DEFAULT_SOURCE_WASM;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Rust Wasm source artifact not found: ${sourcePath}; build it before generating the manifest`);
  }
  const bytes = fs.readFileSync(sourcePath);
  const crateVersion = parseCrateVersion(fs.readFileSync(CARGO_TOML, 'utf8'));
  const assetWasmName = options.assetWasmName || 'syntec_core.wasm';
  const manifest = {
    protocolVersion: PROTOCOL_VERSION,
    crateVersion,
    targetTriple: TARGET_TRIPLE,
    wasmPath: assetWasmName,
    byteLength: bytes.length,
    sha256: computeSha256(bytes),
    exports: REQUIRED_EXPORTS,
    abiFlags: {
      requestAbi: true,
      legacyTextAbi: true,
      formatDocument: true
    },
    builtAt: options.builtAt || new Date().toISOString()
  };
  return { manifest, bytes, sourcePath, assetWasmName };
}

/**
 * 写资产 wasm 与 manifest 到磁盘，覆盖旧版本。返回 `{ manifest, bytes, assetWasmPath, manifestPath }`。
 *
 * @param {{sourceWasm?: string, assetDir?: string, assetWasmName?: string, builtAt?: string}} [options]
 */
function writeAsset(options = {}) {
  const { manifest, bytes } = buildManifestData(options);
  const assetDir = options.assetDir || ASSET_DIR;
  const assetWasmName = options.assetWasmName || 'syntec_core.wasm';
  const assetWasmPath = path.join(assetDir, assetWasmName);
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(assetWasmPath, bytes);
  const manifestPath = path.join(assetDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, bytes, assetWasmPath, manifestPath };
}

/**
 * 校验磁盘上的 manifest 与 wasm 一致：形状、byteLength、sha256。不重写
 * 已有资产；失败抛错供 CI 拦截。返回 `{ manifest, bytes, assetWasmPath, manifestPath }`。
 *
 * @param {{manifestPath?: string, assetDir?: string, assetWasmName?: string}} [options]
 */
function checkAsset(options = {}) {
  const manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH;
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest not found: ${manifestPath}; run without --check first`);
  }
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifest = assertManifestShape(parsed, { requiredExports: REQUIRED_EXPORTS });
  const assetDir = options.assetDir || ASSET_DIR;
  const assetWasmName = options.assetWasmName || 'syntec_core.wasm';
  const assetWasmPath = path.join(assetDir, assetWasmName);
  if (!fs.existsSync(assetWasmPath)) {
    throw new Error(`Rust Wasm artifact not found: ${assetWasmPath}`);
  }
  const bytes = fs.readFileSync(assetWasmPath);
  if (bytes.length !== manifest.byteLength) {
    throw new Error(`byte length mismatch: manifest=${manifest.byteLength}, disk=${bytes.length}`);
  }
  const actualSha = computeSha256(bytes);
  if (actualSha !== manifest.sha256) {
    throw new Error(`SHA-256 mismatch: manifest=${manifest.sha256}, disk=${actualSha}`);
  }
  return { manifest, bytes, assetWasmPath, manifestPath };
}

function main(args = process.argv.slice(2)) {
  const checkMode = args.includes('--check');
  if (checkMode) {
    const { manifest, assetWasmPath, manifestPath } = checkAsset();
    console.info(`Rust Wasm asset OK: ${path.relative(ROOT, assetWasmPath)} (${manifest.byteLength} bytes, sha256=${manifest.sha256.slice(0, 16)}...)`);
    console.info(`Manifest: ${path.relative(ROOT, manifestPath)}`);
    return;
  }
  const { manifest, assetWasmPath, manifestPath } = writeAsset();
  console.info(`Rust Wasm asset written: ${path.relative(ROOT, assetWasmPath)} (${manifest.byteLength} bytes, sha256=${manifest.sha256.slice(0, 16)}...)`);
  console.info(`Manifest: ${path.relative(ROOT, manifestPath)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

module.exports = {
  ASSET_DIR,
  DEFAULT_ASSET_WASM,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_SOURCE_WASM,
  PROTOCOL_VERSION,
  REQUIRED_EXPORTS,
  TARGET_TRIPLE,
  buildManifestData,
  checkAsset,
  main,
  parseCrateVersion,
  writeAsset
};
