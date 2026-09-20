// M3 开发态差分检查：比较 Rust 控制流试点与当前 JavaScript 后端。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createRequest } = require('./benchmarkAnalysis');
const {
  analyzeDocument,
  analyzeNavigationDocument,
  formatDocument
} = require('../src/analysisCore');

const DEFAULT_RUST_CLI = path.join(
  __dirname,
  '..',
  'crates',
  'syntec-core',
  'target',
  'debug',
  process.platform === 'win32' ? 'syntec-core-cli.exe' : 'syntec-core-cli'
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
    name: 'case-default-label',
    text: 'CASE #1 OF\n  DEFAULT:\nEND_CASE;'
  },
  {
    name: 'robot-toolcor-t-arg',
    text: 'TOOLCOR T1;'
  },
  {
    name: 'robot-toolcoron-deprecated',
    text: 'TOOLCORON P1;'
  },
  {
    name: 'robot-toolcor-clear',
    text: 'TOOLCOR CLEAR;'
  },
  {
    name: 'robot-toolcoron-t-arg-ordering',
    text: 'TOOLCORON T1;'
  },
  {
    name: 'robot-toolcor-valid',
    text: 'TOOLCOR P1;'
  },
  {
    name: 'robot-movj-ii-deprecated',
    text: 'MOVJ-II X100.;'
  },
  {
    name: 'robot-movc-xp-point-syntax',
    text: 'MOVC Xp=10.;'
  },
  {
    name: 'robot-mov-direct-arg-equals',
    text: 'MOVJ X=100. FJ50;\nMOVL Y=20. PL3 PQ5;'
  },
  {
    name: 'robot-mov-static-arg-range',
    text: 'MOVL P21;\nINCMOVJ Q25;\nINCMOVL P0;\nUSERCOR P22;\nG68.18 P0;'
  },
  {
    name: 'robot-mov-static-arg-boundary',
    text: 'MOVL P1 X10.;\nINCMOVJ Q5;\nINCMOVL P1;'
  },
  {
    name: 'robot-mov-smooth-conflict',
    text: 'MOVL X10. PL5 PQ10.;'
  },
  {
    name: 'robot-mov-unsupported-smooth',
    text: 'MOVJ PQ5;'
  },
  {
    name: 'robot-mov-movj-p-arg',
    text: 'MOVJ P1;'
  },
  {
    name: 'robot-mov-incmovl-missing-p',
    text: 'INCMOVL X10.;'
  },
  {
    name: 'robot-mov-movc-pair-valid',
    text: 'MOVC X10.;\nMOVC X20.;'
  },
  {
    name: 'robot-mov-movc-pair-unmatched',
    text: 'MOVC X10.;'
  },
  {
    name: 'robot-mov-movc-single-line-x1x2',
    text: 'MOVC X1=10. X2=20.;'
  },
  {
    name: 'robot-mov-coordinate-syntactics',
    text: 'USERCOR P1 F100.;\nTOOLCOR P1 G01 X10.;\nG68.18 P1 MOVJ;'
  },
  {
    name: 'robot-mov-direct-arg-equals-boundary',
    text: 'MOVJ X100.;\nMOVL PL3;'
  },
  {
    name: 'robot-g10-modbus-l1900-c3-missing',
    text: 'G10 L1900 C3;'
  },
  {
    name: 'robot-g10-modbus-l1900-c6-missing',
    text: 'G10 L1900 C6 I165 A1000;'
  },
  {
    name: 'robot-g10-modbus-l1900-c-unknown',
    text: 'G10 L1900 C5;'
  },
  {
    name: 'robot-g10-modbus-l1900-missing-c',
    text: 'G10 L1900;'
  },
  {
    name: 'robot-g10-modbus-l1900-c3-x-unsupported',
    text: 'G10 L1900 C3 I165 A1000 Q1 K1 X1995;'
  },
  {
    name: 'robot-g10-modbus-l1900-c6-qk-unsupported',
    text: 'G10 L1900 C6 I165 A1000 X1995 Q1 K1;'
  },
  {
    name: 'robot-g10-modbus-l1900-valid-c3',
    text: 'G10 L1900 C3 I165 A1000 Q100 K1;'
  },
  {
    name: 'robot-g10-modbus-l1900-integer-decimal',
    text: 'G10 L1900 C3 I165 A1000 Q100 K1.5;'
  },
  {
    name: 'robot-g10-modbus-l1900-range-negative',
    text: 'G10 L1900 C3 I-1 A1000 Q100 K1;'
  },
  {
    name: 'robot-g10-modbus-l1900-range-x-overflow',
    text: 'G10 L1900 C6 I165 A1000 X999999;'
  },
  {
    name: 'robot-g10-modbus-l1900-range-pq-r-register',
    text: 'G10 L1900 C6 I165 A1000 X1995 P99999;'
  },
  {
    name: 'robot-g10-modbus-l1901-missing',
    text: 'G10 L1901 P100;'
  },
  {
    name: 'robot-g10-modbus-l1901-unsupported',
    text: 'G10 L1901 P100 R2 Q1 C3;'
  },
  {
    name: 'robot-g10-modbus-l1901-range-r-overflow',
    text: 'G10 L1901 P100 R300 Q1;'
  },
  {
    name: 'robot-g10-modbus-l1901-valid',
    text: 'G10 L1901 P100 R2 Q1;'
  },
  {
    name: 'robot-stitch-lk-conflict',
    text: 'STITCHON S1 Q1 L500 K5;'
  },
  {
    name: 'robot-stitch-lk-missing',
    text: 'STITCHON S1 Q1;'
  },
  {
    name: 'robot-stitch-l-decimal',
    text: 'STITCHON S1 Q1 L5.5;'
  },
  {
    name: 'robot-stitch-l-only',
    text: 'STITCHON S1 Q1 L500;'
  },
  {
    name: 'robot-weaveon-mixed-p',
    text: 'WEAVEON P1 E5.;'
  },
  {
    name: 'robot-weaveon-q-decimal-warning',
    text: 'WEAVEON E5. Q1;'
  },
  {
    name: 'robot-weaveon-q-decimal-ok',
    text: 'WEAVEON E5. Q1.0;'
  },
  {
    name: 'robot-weaveon-p-only',
    text: 'WEAVEON P3;'
  },
  {
    name: 'robot-signal-swaitsig-limit',
    text: 'MOVL X10.;\nSWAITSIG P1 L10;\nSWAITSIG P2 L10;'
  },
  {
    name: 'robot-signal-syncout-limit',
    text: 'MOVJ X100.;\nSYNCOUT S1 Q1 P1;\nSYNCOUT S1 Q1 P2;\nSYNCOUT S1 Q1 P3;\nSYNCOUT S1 Q1 P4;\nSYNCOUT S1 Q1 P5;\nSYNCOUT S1 Q1 P6;\nSYNCOUT S1 Q1 P7;\nSYNCOUT S1 Q1 P8;\nSYNCOUT S1 Q1 P9;\nSYNCOUT S1 Q1 P10;\nSYNCOUT S1 Q1 P11;'
  },
  {
    name: 'robot-signal-swaitsig-allowed',
    text: 'MOVL X10.;\nSWAITSIG P1 L10;'
  },
  {
    name: 'robot-signal-syncout-allowed',
    text: 'MOVJ X100.;\nSYNCOUT S1 Q1 P1;'
  },
  {
    name: 'robot-signal-wait-clears-state',
    text: 'MOVL X10.;\nSWAITSIG P1 L10;\nWAIT();\nSWAITSIG P1 L10;'
  },
  {
    name: 'robot-signal-stitchon-forbids-movj',
    text: 'STITCHON S1 Q1 L500;\nMOVJ X100.;'
  },
  {
    name: 'robot-signal-stitchon-forbids-weaveon',
    text: 'STITCHON S1 Q1 L500;\nWEAVEON E5. Q1.0 K30.;'
  },
  {
    name: 'robot-signal-stitchon-m96-warning',
    text: 'STITCHON S1 Q1 L500;\nM96;'
  },
  {
    name: 'robot-signal-stitchon-stitchoff-closes',
    text: 'STITCHON S1 Q1 L500;\nSTITCHOFF;\nMOVJ X100.;'
  },
  {
    name: 'robot-signal-weaveon-forbids-movj',
    text: 'WEAVEON E5. Q1.0 K30.;\nMOVJ X100.;'
  },
  {
    name: 'robot-signal-weaveon-forbids-stitchon',
    text: 'WEAVEON E5. Q1.0 K30.;\nSTITCHON S1 Q1 L500;'
  },
  {
    name: 'robot-signal-weaveon-weaveoff-closes',
    text: 'WEAVEON E5. Q1.0 K30.;\nWEAVEOFF;\nMOVJ X100.;'
  },
  {
    name: 'robot-signal-waitsync-forbids-movj',
    text: 'WAITSYNC P1;\nMOVJ X100.;'
  },
  {
    name: 'robot-signal-waitsync-forbids-mcode',
    text: 'WAITSYNC P1;\nM01;'
  },
  {
    name: 'robot-signal-waitsync-endsync-closes',
    text: 'WAITSYNC P1;\nENDSYNC P1;\nMOVJ X100.;'
  },
  {
    name: 'robot-signal-g192-forbids-swaitsig',
    text: 'G192.1 P1;\nSWAITSIG P1 L10;'
  },
  {
    name: 'robot-signal-g192-g1922-closes',
    text: 'G192.1 P1;\nG192.2;\nSWAITSIG P1 L10;'
  },
  {
    name: 'robot-signal-stitchon-movl-skip-forbidden',
    text: 'STITCHON S1 Q1 L500;\nMOVL X10. SKIP;'
  },
  {
    name: 'robot-signal-stitchon-movl-no-skip-allowed',
    text: 'STITCHON S1 Q1 L500;\nMOVL X10.;'
  },
  {
    name: 'robot-signal-mutual-exclusion-stitch-in-weave',
    text: 'WEAVEON E5. Q1.0 K30.;\nSTITCHON S1 Q1 L500;\nSTITCHOFF;'
  },
  {
    name: 'robot-signal-mutual-exclusion-weave-in-stitch',
    text: 'STITCHON S1 Q1 L500;\nWEAVEON E5. Q1.0 K30.;\nWEAVEOFF;'
  },
  {
    name: 'bare-percent-missing-macro-header',
    text: '%\nN10;\nGOTO 10;'
  },
  {
    name: 'macro-header-no-bare-percent-warning',
    text: '%@MACRO\nN10;\nGOTO 10;'
  },
  {
    name: 'goto-target-dynamic-not-checked',
    text: 'GOTO #1;\nN100;'
  },
  {
    name: 'goto-target-in-string-ignored',
    text: 'MSG("GOTO 999");\nN100;'
  },
  {
    name: 'goto-target-in-block-comment-ignored',
    text: '(* GOTO 999 *)\nN100;'
  },
  {
    name: 'goto-multiple-labels-found',
    text: 'N100;\nN200;\nGOTO 100;'
  },
  {
    name: 'goto-reference-line-col-position',
    text: 'N100;\n  GOTO 200;'
  },
  {
    name: 'macro-call-g65-valid',
    text: 'G65 P1000;'
  },
  {
    name: 'macro-call-g66-valid',
    text: 'G66 P1000;'
  },
  {
    name: 'macro-call-g66-1-valid',
    text: 'G66.1 P1000;'
  },
  {
    name: 'macro-call-m98-valid',
    text: 'M98 P8000;'
  },
  {
    name: 'macro-call-m198-valid',
    text: 'M198 P9000;'
  },
  {
    name: 'macro-call-m99-return',
    text: 'M99;'
  },
  {
    name: 'macro-call-m99-p-target',
    text: 'M99 P100;'
  },
  {
    name: 'macro-call-g67-cancel',
    text: 'G67;'
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

/**
 * P0-B 真实 request 传输 path: serialize a full AnalysisRequest JSON and feed
 * it to `syntec-core-cli --request`. The CLI validates protocolVersion / URI /
 * version / languageId / text / profile on the Rust side and emits a single
 * AnalysisResult JSON line. Returns the diagnostics array in the same
 * normalized shape as `getRustDiagnostics`.
 */
function getRustDiagnosticsByRequest(rustCli, text, uri = 'file:///compare.nc', version = 7) {
  const request = JSON.stringify({
    protocolVersion: 1,
    document: { uri, version, languageId: 'syntec-macro', text },
    profile: 'generic'
  });
  const result = spawnSync(rustCli, ['--request'], {
    input: request,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Rust core --request exited with ${result.status}: ${result.stderr || result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  if (trimmed.length === 0) {
    throw new Error('Rust core --request emitted an empty AnalysisResult');
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Rust core --request emitted non-JSON output: ${error.message}\n${trimmed}`);
  }
  if (parsed.protocolVersion !== 1) {
    throw new Error(`unsupported Rust protocol version: ${parsed.protocolVersion}`);
  }
  // Normalize diagnostics; the request-mode JSON is the shared AnalysisResult
  // shape (range + message + severity + source + optional code), so reuse
  // `normalizeDiagnostic` after reshaping into the legacy Record form.
  return (parsed.diagnostics || []).map((diagnostic) => normalizeDiagnostic({
    line: diagnostic.range.start.line + 1,
    col: diagnostic.range.start.character,
    endCol: diagnostic.range.end.character,
    severity: diagnostic.severity,
    code: diagnostic.code
  }));
}

/**
 * P0-B 第 2 项 完整结果— navigation 差分用例集. 与 CASES 不同——后者只关心诊断字段；
 * 海需要专门的用例覆盖 macro file、ISO file、non-macro file、宏头 / N-label /
 * G65/G66/M98/M198 调用边界. 每个用例的 `uri` + `text` 传给 JS analyzeNavigationDocument
 * 与 Rust --request, 逐字段比较 navigation.
 */
const NAVIGATION_CASES = [
  {
    name: 'macro-with-calls',
    uri: 'file:///G1000.nc',
    text: '%@MACRO\nN100;\nG65 P2000;\nM98 P3000;\n'
  },
  {
    name: 'macro-named-call',
    uri: 'file:///G1000.nc',
    text: '%@MACRO\nN1;\nN2;\nG66 P_"Path"\n'
  },
  {
    name: 'macro-extension-matching',
    uri: 'file:///O42.cnc',
    text: '%@MACRO\nN1;\n'
  },
  {
    name: 'macro-no-extension-with-header',
    uri: 'file:///G42',
    text: '%@MACRO\nN1;\n'
  },
  {
    name: 'iso-format-no-macro-header',
    uri: 'file:///iso-demo.nc',
    text: '%\nN1;\nG65 P1000;\n'
  },
  {
    name: 'non-macro-file',
    uri: 'file:///notes.txt',
    text: 'G0 X1;\n'
  },
  {
    name: 'mismatched-basename-no-extension',
    uri: 'file:///README',
    text: 'G0 X1;\nN1;\n'
  },
  {
    name: 'numeric-macro-basename',
    uri: 'file:///1234',
    text: '%@MACRO\nN1;\n'
  },
  {
    name: 'g-prefixed-basename-no-extension',
    uri: 'file:///G9999',
    text: '%@MACRO\nN1;\nG66.1 P_"NamedCall"\n'
  },
  {
    name: 'm198-call-from-macro',
    uri: 'file:///G0072.nc',
    text: '%@MACRO\nN10;\nM198 P555;\n'
  }
];

function getJavaScriptNavigation(uri, text) {
  const fakePath = uri.replace(/^file:\/\/\//, '');
  const request = createRequest(text, uri);
  const result = analyzeNavigationDocument(request, fakePath);
  if (result.navigation === null) return null;
  // Strip `document`/`profile`/`backend` fields so the comparison stays
  // scoped to the navigation payload itself.
  return {
    programEntryName: result.navigation.programEntryName,
    macroProgramName: result.navigation.macroProgramName,
    symbols: result.navigation.symbols,
    calls: result.navigation.calls
  };
}

/**
 * P0-B 第 2 项 edits/TextEdit 差分用例集. Each case asserts a JS formatter
 * output plus a Rust `--request` mode emits the same single whole-document
 * TextEdit (or `edits: []` when the output equals the input).
 */
const FORMAT_CASES = [
  { name: 'blank', text: '' },
  { name: 'macro-header-only', text: '%@MACRO\n' },
  { name: 'program-delimiter', text: '%\n' },
  { name: 'indented-block', text: 'IF #1 = 1 THEN\n#1 := 1;\nEND_IF;\n' },
  { name: 'missing-then-body', text: 'IF #1 = 1 THEN\nEND_IF;\n' },
  { name: 'nested-block', text: 'IF #1 = 1 THEN\nWHILE #2 = 1 DO\n#2 := 2;\nEND_WHILE;\nEND_IF;\n' },
  { name: 'alias-closer', text: 'IF #1 = 1 THEN\n#3 := 3;\nENDIF;\n' },
  { name: 'case-block', text: 'CASE #1 OF\n1:\n#4 := 4;\nEND_CASE;\n' },
  { name: 'repeat-until', text: 'REPEAT\n#5 := #5 + 1;\nUNTIL #5 >= 10 END_REPEAT;\n' },
  { name: 'assignment-equals', text: '#1 = 2;\n' },
  { name: 'control-structure-trailing-semicolon', text: 'IF #1 = 1 THEN;\nEND_IF;\n' },
  { name: 'dangling-comparison', text: '#1 < 2;\n' },
  { name: 'comment-line', text: '@1 := 1; // comment\n' },
  { name: 'block-comment-span', text: '(* block\n comment *)\n@2 := 2;\n' },
  { name: 'string-with-if', text: 'MSG("IF #1 THEN ELSE");\n' },
  { name: 'if-with-inline-body', text: 'IF #1 = 1 THEN #6 := 1; END_IF;\n' },
  { name: 'crlf-eol', text: 'IF #1 = 1 THEN\r\n#1 := 1;\r\nEND_IF;\r\n' }
];

function getJavaScriptEdit(text) {
  const request = createRequest(text, 'file:///formatter.nc');
  const result = formatDocument(request);
  if (result.edits.length === 0) {
    return { editsLength: 0, newText: null };
  }
  // Only one whole-document edit is expected per JS contract.
  return { editsLength: 1, newText: result.edits[0].newText };
}

function getRustEdit(rustCli, text) {
  const request = JSON.stringify({
    protocolVersion: 1,
    document: { uri: 'file:///formatter.nc', version: 1, languageId: 'syntec-macro', text },
    profile: 'generic'
  });
  const result = spawnSync(rustCli, ['--request'], {
    input: request,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Rust core --request exited with ${result.status}: ${result.stderr || result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  if (trimmed.length === 0) {
    throw new Error('Rust core --request emitted an empty AnalysisResult');
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Rust core --request emitted non-JSON output: ${error.message}\n${trimmed}`);
  }
  if (!Array.isArray(parsed.edits)) {
    return { editsLength: 0, newText: null };
  }
  // Allow only 0 or 1 edits; reject multi-edit drift early so the contract
  // stays single whole-document.
  if (parsed.edits.length > 1) {
    throw new Error(`Rust core --request returned multiple TextEdit entries: ${parsed.edits.length}`);
  }
  if (parsed.edits.length === 0) {
    return { editsLength: 0, newText: null };
  }
  return { editsLength: 1, newText: parsed.edits[0].newText };
}

function getRustNavigation(rustCli, uri, text) {
  const request = JSON.stringify({
    protocolVersion: 1,
    document: { uri, version: 17, languageId: 'syntec-macro', text },
    profile: 'generic'
  });
  const result = spawnSync(rustCli, ['--request'], {
    input: request,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Rust core --request exited with ${result.status}: ${result.stderr || result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  if (trimmed.length === 0) {
    throw new Error('Rust core --request emitted an empty AnalysisResult');
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Rust core --request emitted non-JSON output: ${error.message}\n${trimmed}`);
  }
  return parsed.navigation;
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

  // P0-B 真实 request 路径差分: confirm the new --request mode produces
  // exactly the same diagnostics as the legacy text-mode ABI. The 130-case
  // suite is reused so any drift between the two Rust entry points surfaces
  // alongside the JS/Rust parity check.
  let p0BCount = 0;
  for (const testCase of CASES) {
    const legacyDiagnostics = getRustDiagnostics(rustCli, testCase.text);
    const requestDiagnostics = getRustDiagnosticsByRequest(
      rustCli,
      testCase.text,
      `file:///${testCase.name}.nc`,
      17
    );
    if (JSON.stringify(legacyDiagnostics) !== JSON.stringify(requestDiagnostics)) {
      throw new Error(
        `${testCase.name} P0-B request/text mismatch:\n` +
        `legacy:  ${JSON.stringify(legacyDiagnostics)}\n` +
        `request: ${JSON.stringify(requestDiagnostics)}`
      );
    }
    p0BCount += 1;
  }
  console.info(`P0-B analysis request transfer: ${p0BCount}/${CASES.length} cases equivalent under --request mode`);

  // P0-B 第 2 项 完整结果— navigation 差分门禁: 逐字段比较 JS 与 Rust 的
  // navigation 输出（programEntryName / macroProgramName / symbols / calls）。
  // 黄金样例覆盖 macro file / ISO file / non-macro file / 命名调用 /
  // M198 调用 / 不同扩展名与裸 basename 等边界.
  let navigationCount = 0;
  for (const testCase of NAVIGATION_CASES) {
    const jsNavigation = getJavaScriptNavigation(testCase.uri, testCase.text);
    const rustNavigation = getRustNavigation(rustCli, testCase.uri, testCase.text);
    if (JSON.stringify(jsNavigation) !== JSON.stringify(rustNavigation)) {
      throw new Error(
        `${testCase.name} navigation mismatch:\n` +
        `JavaScript: ${JSON.stringify(jsNavigation)}\n` +
        `Rust: ${JSON.stringify(rustNavigation)}`
      );
    }
    navigationCount += 1;
  }
  console.info(`P0-B navigation parity: ${navigationCount}/${NAVIGATION_CASES.length} cases equivalent`);

  // P0-B 第 2 项 edits/TextEdit 差分: 黄金样例逐字段比较 JS formatDocument
  // 与 Rust `--request` 模式产出的整文档 TextEdit.newText.
  let formatCount = 0;
  for (const testCase of FORMAT_CASES) {
    const jsEdit = getJavaScriptEdit(testCase.text);
    const rustEdit = getRustEdit(rustCli, testCase.text);
    if (JSON.stringify(jsEdit) !== JSON.stringify(rustEdit)) {
      throw new Error(
        `${testCase.name} edits mismatch:\n` +
        `JavaScript: ${JSON.stringify(jsEdit)}\n` +
        `Rust: ${JSON.stringify(rustEdit)}`
      );
    }
    formatCount += 1;
  }
  console.info(`P0-B edits parity: ${formatCount}/${FORMAT_CASES.length} formatter cases equivalent`);
}

if (require.main === module) main();

module.exports = {
  CASES,
  NAVIGATION_CASES,
  FORMAT_CASES,
  getJavaScriptDiagnostics,
  getJavaScriptNavigation,
  getJavaScriptEdit,
  getRustDiagnostics,
  getRustDiagnosticsByRequest,
  getRustNavigation,
  getRustEdit,
  normalizeDiagnostic,
  parseRustOutput
};
