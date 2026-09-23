// exportRustBaseline (v4.2.0) 契约测试。
//
// 验证 Rust 自洽 golden file 生成器的模块契约, 不实际运行 Rust CLI
// (真实 CLI 跑通由 compare:rust 门禁与 rust-wasm.yml CI 覆盖).

const assert = require('node:assert');
const { test } = require('node:test');
const path = require('path');
const {
  buildBaseline,
  resolveRustCli,
  DEFAULT_OUTPUT_PATH,
  SCHEMA_VERSION
} = require('../scripts/exportRustBaseline');

test('SCHEMA_VERSION is 1 (与 compareRustCore.js baseline 解析一致)', () => {
  assert.strictEqual(SCHEMA_VERSION, 1);
});

test('DEFAULT_OUTPUT_PATH 指向 tests/fixtures/rust-parity-baseline.json', () => {
  assert.ok(
    DEFAULT_OUTPUT_PATH.endsWith(path.join('tests', 'fixtures', 'rust-parity-baseline.json')),
    `unexpected DEFAULT_OUTPUT_PATH: ${DEFAULT_OUTPUT_PATH}`
  );
});

test('resolveRustCli 优先取 SYNTEC_RUST_CLI 环境变量', () => {
  const saved = process.env.SYNTEC_RUST_CLI;
  process.env.SYNTEC_RUST_CLI = '/tmp/custom-cli';
  try {
    assert.strictEqual(resolveRustCli(), '/tmp/custom-cli');
  } finally {
    if (saved === undefined) delete process.env.SYNTEC_RUST_CLI;
    else process.env.SYNTEC_RUST_CLI = saved;
  }
});

test('resolveRustCli 无环境变量时回退到 compare 默认路径', () => {
  const saved = process.env.SYNTEC_RUST_CLI;
  delete process.env.SYNTEC_RUST_CLI;
  try {
    const cli = resolveRustCli();
    assert.ok(cli.endsWith(process.platform === 'win32' ? 'syntec-core-cli.exe' : 'syntec-core-cli'),
      `unexpected fallback CLI path: ${cli}`);
  } finally {
    if (saved !== undefined) process.env.SYNTEC_RUST_CLI = saved;
  }
});

test('buildBaseline 在 CLI 不存在时抛错并提示构建', () => {
  const saved = process.env.SYNTEC_RUST_CLI;
  process.env.SYNTEC_RUST_CLI = path.join(__dirname, 'nonexistent-cli-9f8e7d6c5b4a');
  try {
    assert.throws(
      () => buildBaseline(process.env.SYNTEC_RUST_CLI),
      /Rust core CLI not found/
    );
  } finally {
    if (saved === undefined) delete process.env.SYNTEC_RUST_CLI;
    else process.env.SYNTEC_RUST_CLI = saved;
  }
});

test('committed baseline fixture 满足 schemaVersion=1 且含三段用例', () => {
  // 守卫 fixture 已随仓库 commit 且 shape 正确, compare:rust 默认路径依赖它.
  const fs = require('node:fs');
  if (!fs.existsSync(DEFAULT_OUTPUT_PATH)) {
    assert.fail(`baseline fixture missing: ${DEFAULT_OUTPUT_PATH}; run 'npm run export:rust:baseline'`);
  }
  const parsed = JSON.parse(fs.readFileSync(DEFAULT_OUTPUT_PATH, 'utf8'));
  assert.strictEqual(parsed.schemaVersion, 1);
  assert.ok(Array.isArray(parsed.cases) && parsed.cases.length > 0, 'cases 非空数组');
  assert.ok(Array.isArray(parsed.navigationCases) && parsed.navigationCases.length > 0, 'navigationCases 非空数组');
  assert.ok(Array.isArray(parsed.formatCases) && parsed.formatCases.length > 0, 'formatCases 非空数组');
  // 每个 case 必须有 name + expected (text/uri 是生成器写入的输入快照).
  for (const c of parsed.cases) {
    assert.ok(typeof c.name === 'string' && c.name.length > 0, `case name 缺失: ${JSON.stringify(c).slice(0, 80)}`);
    assert.ok('expected' in c, `case ${c.name} 缺 expected 字段`);
  }
  for (const c of parsed.navigationCases) {
    assert.ok(typeof c.name === 'string' && c.name.length > 0);
    assert.ok('expected' in c, `navigationCase ${c.name} 缺 expected 字段`);
  }
  for (const c of parsed.formatCases) {
    assert.ok(typeof c.name === 'string' && c.name.length > 0);
    assert.ok('expected' in c, `formatCase ${c.name} 缺 expected 字段`);
  }
});
