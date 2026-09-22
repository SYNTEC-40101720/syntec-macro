// M2 开发态 Parser 原型基准：比较容错 Parser 与当前 JavaScript 分析核心。

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  calculatePercentile,
  createLargeMacroText,
  createRequest
} = require('./benchmarkAnalysis');
const { parseMacroDocument } = require('./parserSpike');
// R1.2 Stage B: ../src/analysisCore removed; analyzeDocument now throws on call.
const _r1_2_retired____src_analysisCore = (name) => () => { throw new Error('R1.2 Stage B: ' + name + ' retired (../src/analysisCore removed)'); };
const analyzeDocument = _r1_2_retired____src_analysisCore('analyzeDocument');

const FIXTURE_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'test-demo.nc');

function measure(fn, input, iterations) {
  fn(input);
  const durations = [];
  let result;
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    result = fn(input);
    durations.push(performance.now() - start);
  }
  return {
    p50Ms: calculatePercentile(durations, 0.5),
    p95Ms: calculatePercentile(durations, 0.95),
    maxMs: Math.max(...durations),
    result
  };
}

function main(args = process.argv.slice(2)) {
  const iterationsIndex = args.indexOf('--iterations');
  const iterations = Number(iterationsIndex >= 0 ? args[iterationsIndex + 1] : 10);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('--iterations must be a positive integer');
  }

  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const largeText = createLargeMacroText(20000);
  const cases = [
    ['fixture', fixtureText, 'file:///tests/fixtures/test-demo.nc'],
    ['large', largeText, 'file:///benchmark/large-macro.nc']
  ];

  console.info(`Parser spike benchmark: ${iterations} measured runs`);
  for (const [name, text, uri] of cases) {
    const parser = measure(parseMacroDocument, text, iterations);
    const analysis = measure(
      request => analyzeDocument(request),
      createRequest(text, uri),
      iterations
    );
    console.info(
      `${name}: ${text.split(/\r?\n/).length} lines; ` +
      `parser p50 ${parser.p50Ms.toFixed(2)} ms / p95 ${parser.p95Ms.toFixed(2)} ms; ` +
      `analysis p50 ${analysis.p50Ms.toFixed(2)} ms / p95 ${analysis.p95Ms.toFixed(2)} ms; ` +
      `blocks ${parser.result.blocks.length}, parser diagnostics ${parser.result.diagnostics.length}`
    );
  }
}

if (require.main === module) main();

module.exports = { main, measure };
