const fs = require('fs');
const path = require('path');
const { DiagnosticCode } = require('../src/diagnosticCodes');
const {
  BLOCK_CLOSERS,
  DIAGNOSTIC_HELP,
  DIAGNOSTIC_REPLACEMENTS,
  FANUC_COMPARISON_REPLACEMENTS
} = require('../src/diagnosticActions');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'docs', '诊断规则与修复动作.md');

const CATEGORY_LABELS = [
  ['SYNTEC_MISSING_', '分号'],
  ['SYNTEC_CONTROL_STRUCTURE_', '分号'],
  ['SYNTEC_UNSUPPORTED_', '不支持语法'],
  ['SYNTEC_CONTROL_', '控制流'],
  ['SYNTEC_NAMED_', '变量'],
  ['SYNTEC_VACANT_', '变量'],
  ['SYNTEC_INVALID_APP_', '变量'],
  ['SYNTEC_ASSIGNMENT_', '风格'],
  ['SYNTEC_FUNCTION_', '函数参数'],
  ['SYNTEC_ROBOT_', '机器人/LTP']
];

function categoryFor(code) {
  const found = CATEGORY_LABELS.find(([prefix]) => code.startsWith(prefix));
  return found ? found[1] : '其他';
}

function severityFor(code) {
  if (code === DiagnosticCode.ASSIGNMENT_STYLE_EQUALS ||
      code === DiagnosticCode.FUNCTION_OPEN_COM_PORT ||
      code === DiagnosticCode.VACANT_ASSIGNMENT ||
      code === DiagnosticCode.CONTROL_UNCLOSED_BLOCK ||
      code === DiagnosticCode.ROBOT_TOOLCORON_DEPRECATED ||
      code === DiagnosticCode.ROBOT_TOOLCOR_CLEAR ||
      code === DiagnosticCode.ROBOT_STITCH_MISSING_ARG ||
      code === DiagnosticCode.ROBOT_WEAVEON_Q_DECIMAL) {
    return 'warning';
  }
  return 'error';
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function quickFixFor(code) {
  if (code === DiagnosticCode.MISSING_SEMICOLON) return '补上行尾 ;';
  if (code === DiagnosticCode.CONTROL_STRUCTURE_TRAILING_SEMICOLON) return '移除控制结构行尾 ;';
  if (code === DiagnosticCode.CONTROL_UNCLOSED_BLOCK) {
    return Object.values(BLOCK_CLOSERS).map(closer => `插入 ${closer}`).join('<br>');
  }
  if (code === DiagnosticCode.UNSUPPORTED_FANUC_COMPARISON) {
    return Object.entries(FANUC_COMPARISON_REPLACEMENTS).map(([from, to]) => `${from} -> ${to}`).join('<br>');
  }
  if (code === DiagnosticCode.ASSIGNMENT_STYLE_EQUALS) return '改为 :=';
  if (code === DiagnosticCode.ROBOT_DIRECT_ARG_EQUALS) return '移除直接引数 =';
  if (code === DiagnosticCode.ROBOT_DEPRECATED_MOVJ_II) return '改为 MOVJ';
  if (code === DiagnosticCode.ROBOT_TOOLCOR_T_ARG) return '改为 P 引数';
  if (code === DiagnosticCode.ROBOT_TOOLCORON_DEPRECATED) return '改为 TOOLCOR';
  if (code === DiagnosticCode.ROBOT_TOOLCOR_CLEAR) return '改为 TOOLCOR P0';
  if (DIAGNOSTIC_REPLACEMENTS[code]) return DIAGNOSTIC_REPLACEMENTS[code].title;
  if (DIAGNOSTIC_HELP[code]) {
    const help = DIAGNOSTIC_HELP[code];
    return typeof help === 'string' ? '查看变量规则说明' : help.title;
  }
  return '-';
}

function noteFor(code) {
  if (code === DiagnosticCode.CONTROL_UNCLOSED_BLOCK) return 'REPEAT 不自动补闭合条件，需人工提供 UNTIL 条件。';
  if (code === DiagnosticCode.UNSUPPORTED_LOGICAL_NOT_OPERATOR ||
      code === DiagnosticCode.UNSUPPORTED_COMPOUND_ASSIGNMENT ||
      code === DiagnosticCode.UNSUPPORTED_INCREMENT) {
    return '语义依上下文变化，不提供自动替换。';
  }
  if (DIAGNOSTIC_HELP[code]) {
    const help = DIAGNOSTIC_HELP[code];
    return typeof help === 'string' ? help : help.message;
  }
  return '-';
}

function rowFor(code) {
  const cells = [
    `\`${code}\``,
    categoryFor(code),
    severityFor(code),
    quickFixFor(code),
    noteFor(code)
  ].map(escapeCell);
  return `| ${cells.join(' | ')} |`;
}

function render() {
  const codes = Object.values(DiagnosticCode).sort();
  const lines = [
    '# 诊断规则与修复动作',
    '',
    '本文档由 `npm run docs:diagnostics` 依据 `src/diagnosticCodes.js` 与 `src/diagnosticActions.js` 生成。',
    '',
    '| Code | 分类 | 默认严重度 | Quick Fix / CodeAction | 说明 |',
    '|---|---|---|---|---|',
    ...codes.map(rowFor),
    '',
    '## 维护说明',
    '',
    '- 新增诊断 code 时，请同步检查 `src/diagnosticActions.js` 是否需要 Quick Fix 或说明型 action。',
    '- 能确定等价替换的场景使用自动 Quick Fix；需要现场语义判断的场景只提供说明型 action。',
    '- 文案可调整，但 code 应保持稳定，避免破坏测试、去重和外部引用。',
    ''
  ];
  return lines.join('\n');
}

fs.writeFileSync(OUTPUT, render(), 'utf8');
console.log(`Generated ${path.relative(ROOT, OUTPUT)}`);
