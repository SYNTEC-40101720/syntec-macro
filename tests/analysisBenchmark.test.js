// 分析性能基准的输入、统计和协议结果回归。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  calculatePercentile,
  createLargeMacroText,
  createRequest,
  measureAnalysis
} = require('../scripts/benchmarkAnalysis');

test('large analysis fixture generator preserves requested line count', () => {
  const text = createLargeMacroText(100);
  assert.strictEqual(text.split(/\r?\n/).length, 100);
  assert.ok(text.startsWith('%@MACRO\n'));
  assert.ok(text.includes('IF #1 = 1 THEN'));
});

test('percentile calculation is deterministic for sorted and unsorted values', () => {
  assert.strictEqual(calculatePercentile([4, 1, 3, 2], 0.5), 2);
  assert.strictEqual(calculatePercentile([4, 1, 3, 2], 0.95), 4);
  assert.throws(() => calculatePercentile([], 0.5), /at least one measurement/);
});

test('analysis benchmark returns a versioned core result summary', () => {
  const result = measureAnalysis(
    createRequest('%@MACRO\n#1 := 1;', 'file:///benchmark.nc'),
    2
  );

  assert.strictEqual(result.lineCount, 2);
  assert.strictEqual(result.iterations, 2);
  assert.strictEqual(result.backend, 'javascript');
  assert.strictEqual(result.diagnosticCount, 0);
  assert.ok(result.p50Ms >= 0);
  assert.ok(result.p95Ms >= result.p50Ms);
  assert.ok(result.maxMs >= result.p95Ms);
});
