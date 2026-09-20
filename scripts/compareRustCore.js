// M3 开发态差分检查：比较 Rust 控制流试点与当前 JavaScript 后端。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createRequest } = require('./benchmarkAnalysis');
const { analyzeDocument } = require('../src/analysisCore');

const DEFAULT_RUST_CLI = path.join(
  __dirname,
  '..',
  'crates',
  'syntec-core',
  'target',
  'debug',
  'syntec-core-cli.exe'
);

const CASES = [
  {
    name: 'balanced-if',
    text: 'IF #1 = 1 THEN\nEND_IF;'
  },
  {
    name: 'unmatched-closer',
    text: 'END_IF;'
  },
  {
    name: 'unclosed-if',
    text: 'IF #1 = 1 THEN'
  },
  {
    name: 'repeat-until',
    text: 'REPEAT\nUNTIL #1 = 1 END_REPEAT;'
  },
  {
    name: 'comments-and-strings',
    text: 'MSG("IF END_IF // text"); // IF\nIF #1 = 1 THEN\nEND_IF;'
  }
];

function normalizeDiagnostic(item) {
  return {
    line: item.line,
    col: item.col,
    endCol: item.endCol || item.col + 1,
    severity: item.severity,
    code: item.code
  };
}

function getJavaScriptDiagnostics(text) {
  const result = analyzeDocument(createRequest(text, 'file:///rust-diff.nc'));
  return result.diagnostics.map(diagnostic => normalizeDiagnostic({
    line: diagnostic.range.start.line + 1,
    col: diagnostic.range.start.character,
    endCol: diagnostic.range.end.character,
    severity: diagnostic.severity,
    code: diagnostic.code
  }));
}

function parseRustOutput(stdout) {
  const diagnostics = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith('diagnostic\t')) continue;
    const [, lineNumber, col, endCol, severity, code] = line.split('\t');
    diagnostics.push(normalizeDiagnostic({
      line: Number(lineNumber),
      col: Number(col),
      endCol: Number(endCol),
      severity,
      code
    }));
  }
  return diagnostics;
}

function getRustDiagnostics(rustCli, text) {
  const result = spawnSync(rustCli, [], {
    input: text,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Rust core exited with ${result.status}: ${result.stderr || result.stdout}`);
  }
  return parseRustOutput(result.stdout);
}

function main() {
  const rustCli = process.env.SYNTEC_RUST_CLI || DEFAULT_RUST_CLI;
  if (!fs.existsSync(rustCli)) {
    throw new Error(`Rust core CLI not found: ${rustCli}; build it before running compare:rust`);
  }

  for (const testCase of CASES) {
    const javascriptDiagnostics = getJavaScriptDiagnostics(testCase.text);
    const rustDiagnostics = getRustDiagnostics(rustCli, testCase.text);
    if (JSON.stringify(javascriptDiagnostics) !== JSON.stringify(rustDiagnostics)) {
      throw new Error(
        `${testCase.name} mismatch:\n` +
        `JavaScript: ${JSON.stringify(javascriptDiagnostics)}\n` +
        `Rust: ${JSON.stringify(rustDiagnostics)}`
      );
    }
    console.info(`${testCase.name}: equivalent control-flow diagnostics`);
  }
}

if (require.main === module) main();

module.exports = {
  CASES,
  getJavaScriptDiagnostics,
  getRustDiagnostics,
  normalizeDiagnostic,
  parseRustOutput
};
