// validatorWorker.js
// Worker 线程入口：在独立线程中执行 validateDocument，避免阻塞 Extension Host

const { parentPort } = require('worker_threads');
const { validateDocument } = require('./validator');

parentPort.on('message', ({ id, content }) => {
  try {
    const diagnostics = validateDocument(content);
    parentPort.postMessage({ id, diagnostics });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});
