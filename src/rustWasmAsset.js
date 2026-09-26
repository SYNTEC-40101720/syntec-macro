// @ts-check
// P0-C 生产 Wasm 资产加载器：版本、完整性、exports 与 ABI flags 校验。
//
// 本模块故意与开发态探针/基准脚本分开维护：
// - 探针/基准从 `crates/syntec-core/target/...` 直接读取开发态 artifact；
// - 生产链路必须经过 `assets/rust-wasm/manifest.json` + SHA-256 + 必需
//   exports 的完整性校验，再交由 `createRustWasmAdapter` 实例化适配器。
//
// 失败必须显式抛出 `RustWasmAssetError`（带 `reason` 字段），上层据此
// 通过 `onFallback` 记录日志并向用户提示（JS 回退已随 R1.2 退役）；
// 不允许把加载失败转成成功形状。
//
// 本模块不注册到 Worker 或 VS Code Provider，只是 P0-C 第 1 项「资产
// 与加载器」边界；Worker 注入由 P0-C 第 3 项完成。

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {(bytes: Buffer) => Promise<WebAssembly.Instance>} WasmInstantiator
 */

/**
 * @typedef {Object} RustWasmManifest
 * @property {number} protocolVersion P0-B 分析协议版本，必须与 `ANALYSIS_PROTOCOL_VERSION` 一致。
 * @property {string} crateVersion Rust crate 版本（来自 `crates/syntec-core/Cargo.toml`）。
 * @property {string} targetTriple 固定 target triple（`wasm32-unknown-unknown`）。
 * @property {string} wasmPath Wasm 二进制相对 manifest 目录的路径（POSIX 风格，避免平台差异）。
 * @property {number} byteLength Wasm 二进制字节数，用于先做 cheap 校验。
 * @property {string} sha256 Wasm 二进制 SHA-256（小写 hex）。
 * @property {string[]} exports 必需 Wasm exports（实例化后逐一比对）。
 * @property {{requestAbi?: boolean, legacyTextAbi?: boolean, formatDocument?: boolean}} [abiFlags]
 *   可选 ABI 标记，加载器只做存在性断言，不解释语义；语义由 `createRustWasmAdapter` 解释。
 * @property {string} [builtAt] ISO 8601 构建时间，只用于审计，不参与校验。
 */

const ASSET_REASONS = Object.freeze({
  MANIFEST_MISSING: 'manifest-missing',
  MANIFEST_INVALID: 'manifest-invalid',
  WASM_PATH_MISSING: 'wasm-path-missing',
  WASM_BYTES_MISMATCH: 'wasm-bytes-mismatch',
  WASM_SHA_MISMATCH: 'wasm-sha-mismatch',
  WASM_INSTANTIATION_FAILED: 'wasm-instantiation-failed',
  EXPORTS_MISMATCH: 'exports-mismatch',
  PROTOCOL_VERSION_MISMATCH: 'protocol-version-mismatch'
});

/**
 * 加载器失败错误。`reason` 字段是 `ASSET_REASONS` 之一，上层据此记录
 * fallback 原因；不暴露 wasm 资产绝对路径或仓库内部结构。
 */
class RustWasmAssetError extends Error {
  /**
   * @param {string} reason
   * @param {string} message
   */
  constructor(reason, message) {
    super(message);
    this.name = 'RustWasmAssetError';
    this.reason = reason;
  }
}

const REQUIRED_MANIFEST_FIELDS = [
  'protocolVersion',
  'crateVersion',
  'targetTriple',
  'wasmPath',
  'byteLength',
  'sha256',
  'exports'
];

const DEFAULT_REQUIRED_EXPORTS = [
  'memory',
  'syntec_core_alloc',
  'syntec_core_dealloc',
  'syntec_core_free_output'
];

/**
 * 计算 buffer 的 SHA-256，返回小写 hex。
 *
 * @param {Buffer} bytes
 * @returns {string}
 */
function computeSha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * 校验 manifest 的形状与必需字段；返回规范化的 manifest。失败抛
 * `RustWasmAssetError(MANIFEST_INVALID)`。
 *
 * @param {unknown} raw
 * @param {{requiredExports?: string[]}} [options]
 * @returns {RustWasmManifest}
 */
function assertManifestShape(raw, options = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest must be a JSON object'
    );
  }
  /** @type {Record<string, unknown>} */
  const record = raw;
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in record)) {
      throw new RustWasmAssetError(
        ASSET_REASONS.MANIFEST_INVALID,
        `manifest is missing required field: ${field}`
      );
    }
  }
  if (!Number.isInteger(record.protocolVersion) || record.protocolVersion <= 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest.protocolVersion must be a positive integer'
    );
  }
  if (typeof record.crateVersion !== 'string' || record.crateVersion.length === 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest.crateVersion must be a non-empty string'
    );
  }
  if (typeof record.targetTriple !== 'string' || record.targetTriple.length === 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest.targetTriple must be a non-empty string'
    );
  }
  if (typeof record.wasmPath !== 'string' || record.wasmPath.length === 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest.wasmPath must be a non-empty string'
    );
  }
  if (!Number.isInteger(record.byteLength) || record.byteLength <= 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest.byteLength must be a positive integer'
    );
  }
  if (typeof record.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(record.sha256)) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest.sha256 must be a 64-character lowercase hex string'
    );
  }
  if (!Array.isArray(record.exports) || record.exports.length === 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      'manifest.exports must be a non-empty array'
    );
  }
  for (const name of record.exports) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new RustWasmAssetError(
        ASSET_REASONS.MANIFEST_INVALID,
        'manifest.exports entries must be non-empty strings'
      );
    }
  }
  const required = new Set(options.requiredExports || DEFAULT_REQUIRED_EXPORTS);
  for (const name of required) {
    if (!record.exports.includes(name)) {
      throw new RustWasmAssetError(
        ASSET_REASONS.MANIFEST_INVALID,
        `manifest.exports is missing required export: ${name}`
      );
    }
  }
  if (record.abiFlags !== undefined) {
    if (record.abiFlags === null || typeof record.abiFlags !== 'object' || Array.isArray(record.abiFlags)) {
      throw new RustWasmAssetError(
        ASSET_REASONS.MANIFEST_INVALID,
        'manifest.abiFlags must be an object'
      );
    }
  }
  return /** @type {RustWasmManifest} */ (record);
}

/**
 * 校验必需 exports 都出现在 Wasm 实例的 exports 中。失败抛
 * `RustWasmAssetError(EXPORTS_MISMATCH)`，不暴露缺哪个 export 的细节
 * 给最终用户，但仍通过 error.message 给开发态足够信息。
 *
 * @param {WebAssembly.Exports} wasmExports
 * @param {string[]} required
 */
function assertRequiredExports(wasmExports, required) {
  const actual = new Set(Object.keys(wasmExports));
  const missing = [];
  for (const name of required) {
    if (!actual.has(name)) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.EXPORTS_MISMATCH,
      `Rust Wasm artifact is missing exports: ${missing.join(', ')}`
    );
  }
}

/**
 * 从磁盘加载 Rust Wasm 资产，做完整性 + 实例化 + exports 校验。
 *
 * 流程（每步失败都抛带 reason 的 `RustWasmAssetError`）：
 * 1. 读 `manifestPath`，JSON 解析 + 形状校验。
 * 2. 解析 manifest.wasmPath（相对于 manifest 目录），读 wasm bytes。
 * 3. manifest.byteLength 与实际 bytes.length 比对（cheap）。
 * 4. SHA-256 与 manifest.sha256 比对（strong）。
 * 5. `WebAssembly.instantiate(bytes, imports)`，捕获编译/链接错误。
 * 6. 校验必需 exports（manifest.exports 是富集集，DEFAULT 必需集为子集）。
 * 7. 返回 `{ instance, manifest, bytes }`，调用方据此构造 `createRustWasmAdapter`。
 *
 * 生产加载器不假设加载路径是仓库内的 `crates/.../target/` 开发产物；
 * 调用方传入 manifest 路径，wasm 路径由 manifest 决定，避免环境之间
 * `target/` 目录差异导致加载了不一致的 artifact。
 *
 * @param {string} manifestPath
 * @param {{instantiator?: WasmInstantiator, requiredExports?: string[]}} [options]
 * @returns {Promise<{instance: WebAssembly.Instance, manifest: RustWasmManifest, bytes: Buffer}>}
 */
async function loadRustWasmAsset(manifestPath, options = {}) {
  if (typeof manifestPath !== 'string' || manifestPath.length === 0) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_MISSING,
      'manifestPath must be a non-empty string'
    );
  }
  let manifestText;
  try {
    manifestText = await fs.promises.readFile(manifestPath, 'utf8');
  } catch (err) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_MISSING,
      `unable to read Rust Wasm manifest: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(manifestText);
  } catch (err) {
    throw new RustWasmAssetError(
      ASSET_REASONS.MANIFEST_INVALID,
      `Rust Wasm manifest is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const manifest = assertManifestShape(parsed, options);

  const manifestDir = path.dirname(manifestPath);
  const wasmPath = path.resolve(manifestDir, manifest.wasmPath);
  let bytes;
  try {
    bytes = await fs.promises.readFile(wasmPath);
  } catch (err) {
    throw new RustWasmAssetError(
      ASSET_REASONS.WASM_PATH_MISSING,
      `unable to read Rust Wasm artifact: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (bytes.length !== manifest.byteLength) {
    throw new RustWasmAssetError(
      ASSET_REASONS.WASM_BYTES_MISMATCH,
      `Rust Wasm byte length mismatch: expected ${manifest.byteLength}, got ${bytes.length}`
    );
  }
  const actualSha = computeSha256(bytes);
  if (actualSha !== manifest.sha256) {
    throw new RustWasmAssetError(
      ASSET_REASONS.WASM_SHA_MISMATCH,
      'Rust Wasm SHA-256 mismatch: artifact integrity check failed'
    );
  }

  const instantiator = options.instantiator || (async (buffer) => {
    const { instance } = await WebAssembly.instantiate(buffer);
    return instance;
  });
  let instance;
  try {
    instance = await instantiator(Buffer.from(bytes));
  } catch (err) {
    throw new RustWasmAssetError(
      ASSET_REASONS.WASM_INSTANTIATION_FAILED,
      `Rust Wasm instantiation failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!instance || typeof instance !== 'object') {
    throw new RustWasmAssetError(
      ASSET_REASONS.WASM_INSTANTIATION_FAILED,
      'Rust Wasm instantiator returned a non-instance'
    );
  }
  const required = options.requiredExports || DEFAULT_REQUIRED_EXPORTS;
  assertRequiredExports(instance.exports, required);

  return { instance, manifest, bytes };
}

module.exports = {
  ASSET_REASONS,
  DEFAULT_REQUIRED_EXPORTS,
  RustWasmAssetError,
  assertManifestShape,
  assertRequiredExports,
  computeSha256,
  loadRustWasmAsset
};
