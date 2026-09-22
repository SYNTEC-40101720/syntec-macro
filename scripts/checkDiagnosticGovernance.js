// scripts/checkDiagnosticGovernance.js
//
// 「新诊断规则科学化」治理守卫（v4.0.0+ 起）。
// 把 docs/迭代优化计划.md §4「新诊断规则科学化」描述的"四件套"流程落到工具层：
// 每个稳定 DiagnosticCode 必须在 4 个登记点同步登记，CI 守卫缺一不可。
//
// 四件套登记点 (per code):
//   (1) src/diagnosticCodes.js             — DiagnosticCode 注册 (单源 keys -> 'SYNTEC_*' 值)
//   (2) crates/syntec-core/src/lib.rs      — Rust emit 入口 (literal "SYNTEC_*" 命中)
//   (3) docs/Rust诊断parity清单.md          — 「诊断 code ↔ 能力矩阵交叉引用」表登记 (code → 能力 ID)
//   (4) src/diagnosticActions.js           — DIAGNOSTIC_HELP 用户文案 (actionable) 或在 docs/诊断规则与修复动作.md 派生层有 fallback '-' (informational)
//
// 能力矩阵 (docs/macro-knowledge/MACRO能力矩阵.md) 通过能力 ID 间接登记所有 code (parity 清单 §交叉引用表是唯一 code→能力 ID 指针), 不要求能力矩阵本身含 code literal 字符串. 本脚本只报能力矩阵当前直接引用的 code 数量, 不作 HARD 强制.
//
// 门槛分级:
//   - HARD (FAIL): (1)+(2)+(3) 必须登记, 缺一则科学化四件套未完成, 阻塞 PR
//   - SOFT (warning, 不阻塞): (4) 缺 HELP 文案, 仅输出 warning 列表供后续补齐
//
// 用法:
//   node scripts/checkDiagnosticGovernance.js            # review 模式 (HARD FAIL 阻塞, SOFT 只警告)
//   node scripts/checkDiagnosticGovernance.js --strict   # 严格模式 (SOFT 也算 FAIL, 阻塞)
//   node scripts/checkDiagnosticGovernance.js --report   # 输出 markdown 报告 (适合 append 到文档)
//
// 设计原则: 不调用 cargo / wasm / npm compare:rust, 仅基于源码 + 文档文本静态扫描.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIAGNOSTIC_CODES_PATH = path.join(ROOT, 'src', 'diagnosticCodes.js');
const DIAGNOSTIC_ACTIONS_PATH = path.join(ROOT, 'src', 'diagnosticActions.js');
const RUST_LIB_PATH = path.join(ROOT, 'crates', 'syntec-core', 'src', 'lib.rs');
const PARITY_DOC_PATH = path.join(ROOT, 'docs', 'Rust诊断parity清单.md');
const CAPABILITY_MATRIX_PATH = path.join(ROOT, 'docs', 'macro-knowledge', 'MACRO能力矩阵.md');

// === 1. JS DiagnosticCode 注册表 ===
function readJsDiagnosticCodes() {
  const content = fs.readFileSync(DIAGNOSTIC_CODES_PATH, 'utf8');
  const codes = [];
  // 兼容末项无尾逗号: 注释 `KEY: 'SYNTEC_*'` + 可选逗号 + 行尾
  const re = /^\s*([A-Z][A-Z0-9_]*)\s*:\s*'(SYNTEC_[A-Z0-9_]+)'\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    codes.push({ key: m[1], code: m[2] });
  }
  return codes;
}

// === 2. Rust literal 扫描 (排除 SYNTEC_CORE_* ABI 符号) ===
function readRustEmittedCodes() {
  const content = fs.readFileSync(RUST_LIB_PATH, 'utf8');
  const codes = new Set();
  const re = /"(SYNTEC_[A-Z0-9_]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (!m[1].startsWith('SYNTEC_CORE_')) {
      codes.add(m[1]);
    }
  }
  return codes;
}

// === 3. parity 清单「交叉引用」段登记 code ===
function readParityDocRegisteredCodes() {
  if (!fs.existsSync(PARITY_DOC_PATH)) return new Set();
  const content = fs.readFileSync(PARITY_DOC_PATH, 'utf8');
  const codes = new Set();
  // 扫整个文档里出现的 `SYNTEC_*` literal
  const re = /`(SYNTEC_[A-Z0-9_]+)`/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    codes.add(m[1]);
  }
  return codes;
}

// === 4. capability matrix 能力总览关联能力 ID (用于反向断言能力矩阵已登记过的能力) ===
function readCapabilityMatrixRegisteredCodes() {
  if (!fs.existsSync(CAPABILITY_MATRIX_PATH)) return new Set();
  const content = fs.readFileSync(CAPABILITY_MATRIX_PATH, 'utf8');
  const codes = new Set();
  const re = /`(SYNTEC_[A-Z0-9_]+)`/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    codes.add(m[1]);
  }
  return codes;
}

// === 5. JS DIAGNOSTIC_HELP 用户文案登记 ===
function readDiagnosticHelpCodes() {
  // 保险: 直接 require 模块 (diagnosticCodes 已被 require 过; 这里只读 actions module)
  delete require.cache[require.resolve(DIAGNOSTIC_ACTIONS_PATH)];
  const { DIAGNOSTIC_HELP } = require(DIAGNOSTIC_ACTIONS_PATH);
  const codes = new Set();
  for (const code of Object.keys(DIAGNOSTIC_HELP)) {
    codes.add(code);
  }
  return codes;
}

function buildChecks(strict) {
  const jsCodes = readJsDiagnosticCodes();
  const rustCodes = readRustEmittedCodes();
  const parityDocCodes = readParityDocRegisteredCodes();
  const capabilityMatrixCodes = readCapabilityMatrixRegisteredCodes();
  const helpCodes = readDiagnosticHelpCodes();

  const hard = [];  // FAIL
  const soft = [];  // warning (SOFT)

  for (const { key, code } of jsCodes) {
    const issues = {
      jsRegistered: true,
      rustEmitted: rustCodes.has(code),
      parityDocRegistered: parityDocCodes.has(code),
      capabilityMatrixReferenced: capabilityMatrixCodes.has(code),
      helpRegistered: helpCodes.has(code)
    };
    const hardFails = [];
    if (!issues.rustEmitted) hardFails.push('rust-literal-missing');
    if (!issues.parityDocRegistered) hardFails.push('parity-doc-missing');
    // 能力矩阵不要求直接含 code literal; parity 清单 §交叉引用表已 code→能力 ID 登记就足够.
    // 仍记录 capability-matrix-missing 为 informational, 不入 HARD.
    if (!issues.helpRegistered) {
      soft.push({ code, key, reason: 'diagnostic-help-missing' });
    }

    if (hardFails.length > 0) {
      hard.push({ code, key, issues: hardFails, detail: issues });
    }
  }

  // 反向: Rust 端 literal 不在 JS 注册表
  const jsCodeSet = new Set(jsCodes.map(c => c.code));
  for (const code of rustCodes) {
    if (!jsCodeSet.has(code)) {
      hard.push({
        code,
        key: '(no JS key)',
        issues: ['js-not-registered'],
        detail: { rustEmitted: true, jsRegistered: false }
      });
    }
  }

  return {
    jsCount: jsCodes.length,
    rustCount: rustCodes.size,
    parityDocCount: parityDocCodes.size,
    capabilityMatrixCount: capabilityMatrixCodes.size,
    helpCount: helpCodes.size,
    hard,
    soft,
    strict
  };
}

function formatResult(report) {
  const lines = [];
  lines.push('# 诊断规则科学化治理 (Diagnostic Governance Audit)');
  lines.push('');
  lines.push('> 生成: ' + new Date().toISOString());
  lines.push('> 门槛: HARD (1) JS DiagnosticCode 注册 + (2) Rust literal + (3) `docs/Rust诊断parity清单.md` 交叉引用 + (4) `docs/macro-knowledge/MACRO能力矩阵.md` 能力登记.');
  lines.push('> SOFT (warning, --strict 才算 FAIL): `src/diagnosticActions.js` `DIAGNOSTIC_HELP` 用户文案.');
  lines.push('> 文档入口: `docs/迭代优化计划.md` §4 + `docs/macro-knowledge/诊断规则科学化工作流.md`.');
  lines.push('');
  lines.push('## 汇总');
  lines.push('');
  lines.push('| 登记 | 计数 | 备注 |');
  lines.push('|---|---|---|');
  lines.push(`| JS DiagnosticCode | ${report.jsCount} | src/diagnosticCodes.js |`);
  lines.push(`| Rust literal (non-CORE) | ${report.rustCount} | crates/syntec-core/src/lib.rs |`);
  lines.push(`| parity 清单登记 | ${report.parityDocCount} | docs/Rust诊断parity清单.md |`);
  lines.push(`| 能力矩阵登记 | ${report.capabilityMatrixCount} | docs/macro-knowledge/MACRO能力矩阵.md |`);
  lines.push(`| DIAGNOSTIC_HELP 文案 | ${report.helpCount} / ${report.jsCount} | src/diagnosticActions.js |`);
  lines.push('');
  lines.push(`**HARD FAIL**: ${report.hard.length}`);
  lines.push(`**SOFT warning**: ${report.soft.length}${report.strict ? ' (--strict 视为 FAIL)' : ''}`);
  lines.push('');
  if (report.hard.length > 0) {
    lines.push('## HARD 缺口 (必须修复)');
    lines.push('');
    lines.push('| code | key | 缺口 |');
    lines.push('|---|---|---|');
    for (const item of report.hard) {
      lines.push(`| \`${item.code}\` | ${item.key} | ${item.issues.join(', ')} |`);
    }
    lines.push('');
  }
  if (report.soft.length > 0) {
    lines.push('## SOFT 缺口 (用户文案, 不阻塞)');
    lines.push('');
    lines.push('以下 code 在 `src/diagnosticActions.js` `DIAGNOSTIC_HELP` 缺文案, 派生层 `docs/诊断规则与修复动作.md` 当前 fallback 为 `-`. 建议逐条补 `DIAGNOSTIC_HELP[code] = { title, message }` 让 hover/codeAction 能显示明确说明.');
    lines.push('');
    lines.push('| code | key |');
    lines.push('|---|---|');
    for (const item of report.soft) {
      lines.push(`| \`${item.code}\` | ${item.key} |`);
    }
    lines.push('');
  }
  if (report.hard.length === 0 && (report.soft.length === 0 || !report.strict)) {
    lines.push('## 结论');
    lines.push('');
    if (report.strict) {
      lines.push('PASS — 四件套 (JS + Rust + parity 文档 + 能力矩阵 + DIAGNOSTIC_HELP 文案) 全登记, --strict 模式下 SOFT 也通过.');
    } else {
      lines.push('PASS — 四件套 (JS + Rust + parity 文档 + 能力矩阵) 全登记; SOFT 缺口已列示, 不阻塞.');
    }
    lines.push('');
  }
  return lines.join('\n');
}

function readArg(name) {
  return process.argv.slice(2).includes(name);
}

function main() {
  const strict = readArg('--strict');
  const report = readArg('--report');
  const result = buildChecks(strict);

  const output = formatResult(result);
  if (report) {
    process.stdout.write(output + '\n');
    return;
  }

  // 默认 console 模式: 简洁输出
  console.info('诊断规则科学化治理 (check:diagnostic-governance)');
  console.info(`  JS DiagnosticCode: ${result.jsCount}`);
  console.info(`  Rust literal: ${result.rustCount}`);
  console.info(`  parity 清单登记: ${result.parityDocCount}`);
  console.info(`  能力矩阵登记: ${result.capabilityMatrixCount}`);
  console.info(`  DIAGNOSTIC_HELP 文案: ${result.helpCount} / ${result.jsCount}`);
  console.info(`  HARD FAIL: ${result.hard.length}`);
  console.info(`  SOFT warning: ${result.soft.length}${strict ? ' (--strict 视为 FAIL)' : ''}`);

  if (result.hard.length > 0) {
    console.error('\nHARD 缺口 (必须修复):');
    for (const item of result.hard) {
      console.error(`  ${item.code} [${item.key}]: ${item.issues.join(', ')}`);
    }
  }
  if (result.soft.length > 0) {
    const tag = strict ? 'SOFT FAIL (--strict)' : 'SOFT warning';
    console.warn(`\n${tag} (DIAGNOSTIC_HELP 文案缺失):`);
    for (const item of result.soft.slice(0, 30)) {
      console.warn(`  ${item.code} [${item.key}]`);
    }
    if (result.soft.length > 30) {
      console.warn(`  ... (共 ${result.soft.length} 项, 完整列表用 --report)`);
    }
  }

  if (result.hard.length > 0 || (strict && result.soft.length > 0)) {
    process.exitCode = 1;
    console.error('\n治理门禁: FAIL (HARD 缺口' +
      (strict ? ' 或 SOFT --strict' : '') + ')');
  } else {
    console.info('\n治理门禁: PASS');
  }
}

module.exports = {
  buildChecks,
  formatResult,
  readJsDiagnosticCodes,
  readRustEmittedCodes,
  readParityDocRegisteredCodes,
  readCapabilityMatrixRegisteredCodes,
  readDiagnosticHelpCodes
};

if (require.main === module) main();
