// @ts-check
// 基准共享 helper：fixture 生成 / request 构造 / 百分位计算。
//
// R1.2 Stage B (2026-09-22): JS analyzeDocument 路径已退役 (analysisCore.js
// git rm)，本脚本不再有独立 CLI 入口，只作为 benchmark:rust:wasm /
// probe:rust:wasm / benchmark:compare 与测试共享的纯函数库。

const path = require('path');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('../src/analysisProtocol');

const DEFAULT_LARGE_LINE_COUNT = 20000;

const FIXTURE_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'test-demo.nc');

/**
 * @param {number} [lineCount]
 * @returns {string}
 */
function createLargeMacroText(lineCount = DEFAULT_LARGE_LINE_COUNT) {
  if (!Number.isInteger(lineCount) || lineCount < 4) {
    throw new Error('lineCount must be an integer greater than or equal to 4');
  }

  const lines = ['%@MACRO'];
  for (let lineIndex = 1; lineIndex < lineCount; lineIndex++) {
    const blockOffset = lineIndex % 97;
    if (lineIndex >= 97 && blockOffset === 0) {
      lines.push('IF #1 = 1 THEN');
    } else if (lineIndex >= 97 && blockOffset === 1) {
      lines.push('#2 := SQRT(4);');
    } else if (lineIndex >= 97 && blockOffset === 2) {
      lines.push('END_IF;');
    } else if (lineIndex % 31 === 0) {
      lines.push(`G65 P${1000 + (lineIndex % 20)} A${lineIndex};`);
    } else if (lineIndex % 17 === 0) {
      lines.push('MSG("中文 // 保留字符串");');
    } else {
      lines.push(`#1 := #1 + ${lineIndex % 100};`);
    }
  }
  return lines.join('\n');
}

/**
 * @param {string} text
 * @param {string} uri
 * @returns {import('../src/analysisProtocol').AnalysisRequest}
 */
function createRequest(text, uri) {
  return createAnalysisRequest(createDocumentSnapshot({
    uri,
    version: 1,
    languageId: 'syntec-macro',
    text
  }));
}

/**
 * @param {number[]} values
 * @param {number} percentile
 * @returns {number}
 */
function calculatePercentile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('values must contain at least one measurement');
  }
  if (percentile <= 0 || percentile > 1) {
    throw new Error('percentile must be greater than 0 and less than or equal to 1');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

module.exports = {
  DEFAULT_LARGE_LINE_COUNT,
  FIXTURE_PATH,
  calculatePercentile,
  createLargeMacroText,
  createRequest
};
