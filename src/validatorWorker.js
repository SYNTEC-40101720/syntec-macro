// validatorWorker.js
// Worker 线程入口：在独立线程中执行分析后端，避免阻塞 Extension Host

const { parentPort } = require('worker_threads');
const { AnalysisHost } = require('./analysisHost');

const analysisHost = new AnalysisHost();

parentPort.on('message', ({ id, request }) => {
  try {
    const result = analysisHost.analyze(request);
    parentPort.postMessage({ id, result });
  } catch (err) {
    parentPort.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});
