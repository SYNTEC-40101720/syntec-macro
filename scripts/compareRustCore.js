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
  },
  {
    name: 'unmatched-else',
    text: 'ELSE'
  },
  {
    name: 'unmatched-elseif',
    text: 'ELSEIF #1 = 1 THEN'
  },
  {
    name: 'unsupported-elsif',
    text: 'ELSIF #1 = 1 THEN'
  },
  {
    name: 'unsupported-div',
    text: '#1 := #2 DIV #3;'
  },
  {
    name: 'trailing-header-semicolon',
    text: 'IF #1 = 1 THEN;'
  },
  {
    name: 'trailing-branch-semicolon',
    text: 'ELSE;'
  },
  {
    name: 'unsupported-equality',
    text: '#1 == #2;'
  },
  {
    name: 'unsupported-inequality',
    text: '#1 != #2;'
  },
  {
    name: 'unsupported-logical-and',
    text: '#1 && #2;'
  },
  {
    name: 'unsupported-logical-or',
    text: '#1 || #2;'
  },
  {
    name: 'unsupported-compound-assignment',
    text: '#1 += 1;'
  },
  {
    name: 'unsupported-increment',
    text: '#1++;'
  },
  {
    name: 'unsupported-percent',
    text: '#1 % #2;'
  },
  {
    name: 'unsupported-logical-not',
    text: '!#1;'
  },
  {
    name: 'unsupported-fanuc-comparison',
    text: '#1 EQ #2;'
  },
  {
    name: 'missing-right-parenthesis',
    text: '(#1 + 1;'
  },
  {
    name: 'missing-right-bracket',
    text: '#1 := [1 + 2;'
  },
  {
    name: 'extra-right-parenthesis',
    text: ');'
  },
  {
    name: 'parenthesis-string-boundary',
    text: 'MSG(\"(\");'
  },
  {
    name: 'static-mod-decimal',
    text: '1 MOD 2.5;'
  },
  {
    name: 'static-mod-integer',
    text: '1 MOD 2;'
  },
  {
    name: 'missing-assignment-semicolon',
    text: '#1 := 1'
  },
  {
    name: 'missing-end-semicolon',
    text: 'END_IF'
  },
  {
    name: 'header-without-semicolon',
    text: 'IF #1 = 1 THEN'
  },
  {
    name: 'case-label-without-semicolon',
    text: '1:'
  },
  {
    name: 'missing-g-code-semicolon',
    text: 'G65 P1000'
  },
  {
    name: 'static-math-domain',
    text: '#1 := ATAN2(0, 0);\n#2 := POW(-1, 2);\n#3 := LN(0);\n#4 := SQRT(-1);\n#5 := ACOS(1.1);\n#6 := ASIN(-1.1);'
  },
  {
    name: 'dynamic-math-domain-boundary',
    text: '#1 := ATAN2(#2, #3);\n#4 := SQRT(#5 + 1);\n#6 := ACOS(1);'
  },
  {
    name: 'static-io-ranges',
    text: 'READDI(512);\nSETDO(1, 2);\nREADRREGBIT(65536, 0);\nREADRREGBIT(1, 32);'
  },
  {
    name: 'dynamic-io-ranges',
    text: 'READDI(#1);\nSETDO(#1, #2);\nREADRREGBIT(#3, #4);\nSETRREGBIT(1, 2, 1);'
  },
  {
    name: 'basic-function-ranges',
    text: 'ALARM(65536);\nMSG(-1);\nPARAM(1.5, 2);\nCHKINF(6);'
  },
  {
    name: 'dynamic-basic-function-ranges',
    text: 'ALARM(#1);\nMSG(#2);\nPARAM(#3, #4);\nCHKINF(#5);'
  },
  {
    name: 'variable-access-boundaries',
    text: '#TEMP := 1;\n@TEMP := 1;\n#0 := 1;\n@0 := 1;\nAR-1;\nMAR1.5;\nAR[-2];'
  },
  {
    name: 'dynamic-variable-access',
    text: 'AR[#1];\nMAR[100];\n#1 := 1;'
  },
  {
    name: 'reserved-r-writes',
    text: '@401 := 1;\n@440 := 1;\n@10081 := 1;\n@10512 := 1;\n@111000 := 1;\n@450 := 1;\n@10500 := 1;'
  },
  {
    name: 'string-function-warnings',
    text: 'OPEN(\"COM1\");\nAXID(\"Y\");\nOPEN(\"file.nc\");\nAXID(Y);\nMSG(\"OPEN(\\\\\"COM1\\\\\")\");'
  },
  {
    name: 'sysdata-drvdata-formats',
    text: 'SYSDATA(336.5);\nSYSDATA(\"336\");\nDRVDATA(1000.5, 3366);\nDRVDATA(1000, \"bad\");'
  },
  {
    name: 'valid-sysdata-drvdata',
    text: 'SYSDATA(336);\nDRVDATA(1000, 3366);\nDRVDATA(1000, \"1Ah\");\nDRVDATA(1000, #1);'
  },
  {
    name: 'assignment-style-equals',
    text: '#1 = 2;\n@3 = #1;\nAR1 = 3;\nMAR[2] = 4;'
  },
  {
    name: 'assignment-style-boundary',
    text: 'IF #1 = 2 THEN\n#1 := 2;\nEND_IF;'
  },
  {
    name: 'chinese-code-boundaries',
    text: '中文;\n#1 := 1；\nMSG(\"中文\"); // 中文\n(* 中文 *)\n#2 := 2;'
  },
  {
    name: 'goto-and-macro-call-boundaries',
    text: 'GOTO 200;\nN100;\nGOTO 100;\nG65 P1000 G01;'
  },
  {
    name: 'valid-goto-and-macro-call',
    text: 'GOTO 100;\nN100;\nG65 P1000;'
  },
  {
    name: 'elseif-after-else',
    text: 'IF #1 = 1 THEN\nELSE\nELSEIF #2 = 2 THEN\nEND_IF;'
  },
  {
    name: 'exit-boundary',
    text: 'IF #1 = 1 THEN\nWHILE #2 = 1 DO\nEXIT;'
  },
  {
    name: 'nesting-depth',
    text: [
      ...Array(11).fill('IF #1 = 1 THEN'),
      ...Array(11).fill('END_IF;')
    ].join('\n')
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
      code: code || undefined
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
