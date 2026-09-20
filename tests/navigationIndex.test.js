// tests/navigationIndex.test.js
// Phase 3 Step 8：navigationIndex 单元测试。聚焦 navigationIndex.js 中两个
// 纯函数边界，不依赖 vscode API：
//   - isPotentialNavigationFile: 判定扩展名与无后缀文件的导航候选资格
//   - collectNavigationIndexEntries: 并发消费无重排、isCancelled 早返、
//     loadIndex 抛错跳过、isPotentialNavigationFile 过滤、concurrency=1 串行

const assert = require('node:assert');
const { test } = require('node:test');
const {
  collectNavigationIndexEntries,
  isPotentialNavigationFile
} = require('../src/navigationIndex');

test('isPotentialNavigationFile returns true for known macro extensions', () => {
  assert.strictEqual(isPotentialNavigationFile('/workspace/sample.nc'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/sample.cnc'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/sample.tap'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/sample.prt'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/sample.mpf'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/sample.ptp'), true);
});

test('isPotentialNavigationFile returns true for extensionless files', () => {
  // 无后缀文件是 G/O 程序常用形式，应作为候选
  assert.strictEqual(isPotentialNavigationFile('/workspace/G0200'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/O0100'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/extensionless'), true);
});

test('isPotentialNavigationFile returns false for non-macro extensions', () => {
  assert.strictEqual(isPotentialNavigationFile('/workspace/readme.txt'), false);
  assert.strictEqual(isPotentialNavigationFile('/workspace/index.js'), false);
  assert.strictEqual(isPotentialNavigationFile('/workspace/data.json'), false);
  assert.strictEqual(isPotentialNavigationFile('/workspace/notes.md'), false);
});

test('isPotentialNavigationFile returns true for program-entry basenames (no extension)', () => {
  // getProgramEntryName 只匹配 basename 形如 /^[GO]\d+$/i 且不带后缀。
  // 带后缀的文件名按 MACRO_FILE_EXTENSIONS 判定（.txt/.json 不是 macro 扩展名）。
  assert.strictEqual(isPotentialNavigationFile('/workspace/G0200'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/O0100'), true);
  assert.strictEqual(isPotentialNavigationFile('/workspace/G0200.txt'), false);
  assert.strictEqual(isPotentialNavigationFile('/workspace/O0100.json'), false);
});

test('collectNavigationIndexEntries preserves input order under concurrency=1 (serial)', async () => {
  const files = ['a.nc', 'b.nc', 'c.nc', 'd.nc'].map(p => ({ path: p }));
  const loaded = [];
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: f => f.path,
    concurrency: 1,
    isCancelled: () => false,
    async loadIndex(file) {
      loaded.push(file.path);
      return { programEntryName: file.path.toUpperCase(), symbols: [], calls: [] };
    }
  });
  // 串行加载应保留输入顺序
  assert.deepStrictEqual(loaded, ['a.nc', 'b.nc', 'c.nc', 'd.nc']);
  assert.strictEqual(entries.length, 4);
  assert.deepStrictEqual(entries.map(e => e.file.path), ['a.nc', 'b.nc', 'c.nc', 'd.nc']);
});

test('collectNavigationIndexEntries preserves input order under concurrency=32 (parallel)', async () => {
  // 并发模式下仍要保证输出顺序与输入一致（entries[fileIndex]）
  const files = Array.from({ length: 20 }, (_, i) => ({ id: i, path: `file${i}.nc` }));
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: f => f.path,
    concurrency: 32,
    isCancelled: () => false,
    async loadIndex(file) {
      // 加入随机延迟模拟并发
      await new Promise(r => setTimeout(r, Math.random() * 5));
      return { programEntryName: `F${file.id}`, symbols: [], calls: [] };
    }
  });
  assert.strictEqual(entries.length, 20);
  // entries 顺序应严格等于输入顺序
  assert.deepStrictEqual(
    entries.map(e => e.file.id),
    Array.from({ length: 20 }, (_, i) => i)
  );
});

test('collectNavigationIndexEntries skips files where isPotentialNavigationFile is false', async () => {
  const files = [
    { path: 'good.nc' },
    { path: 'skip.txt' },
    { path: 'good.cnc' },
    { path: 'skip.md' }
  ];
  const loadedPaths = [];
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: f => f.path,
    concurrency: 4,
    isCancelled: () => false,
    async loadIndex(file) {
      loadedPaths.push(file.path);
      return { programEntryName: file.path, symbols: [], calls: [] };
    }
  });
  // 只 .nc 和 .cnc 进入了 loadIndex，.txt/.md 被 isPotentialNavigationFile filter
  assert.deepStrictEqual(loadedPaths.sort(), ['good.cnc', 'good.nc']);
  assert.strictEqual(entries.length, 2);
});

test('collectNavigationIndexEntries skips files where loadIndex throws', async () => {
  const files = [{ path: 'ok.nc' }, { path: 'throws.nc' }, { path: 'ok2.nc' }];
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: f => f.path,
    concurrency: 4,
    isCancelled: () => false,
    async loadIndex(file) {
      if (file.path === 'throws.nc') throw new Error('boom');
      return { programEntryName: file.path, symbols: [], calls: [] };
    }
  });
  // loadIndex 抛错的文件被 catch+continue 跳过，不传播
  assert.strictEqual(entries.length, 2);
  assert.deepStrictEqual(entries.map(e => e.file.path).sort(), ['ok.nc', 'ok2.nc']);
});

test('collectNavigationIndexEntries stops early when isCancelled returns true', async () => {
  const files = Array.from({ length: 50 }, (_, i) => ({ path: `f${i}.nc` }));
  let loadCount = 0;
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: f => f.path,
    concurrency: 4,
    isCancelled: () => loadCount >= 3,
    async loadIndex() {
      loadCount++;
      return { programEntryName: 'x', symbols: [], calls: [] };
    }
  });
  // 应在加载约 3 条后早返
  assert.ok(loadCount <= 10, `expected cancellation near 3, got ${loadCount}`);
  assert.ok(entries.length <= loadCount);
});

test('collectNavigationIndexEntries handles empty files array', async () => {
  const entries = await collectNavigationIndexEntries([], {
    getFilePath: () => '',
    concurrency: 32,
    isCancelled: () => false,
    async loadIndex() { return null; }
  });
  assert.deepStrictEqual(entries, []);
});

test('collectNavigationIndexEntries filters out null index results', async () => {
  const files = [{ path: 'a.nc' }, { path: 'b.nc' }];
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: f => f.path,
    concurrency: 1,
    isCancelled: () => false,
    async loadIndex(file) {
      // 文件 a 返回有效 index，文件 b 返回 null（如非 macro 文件）
      if (file.path === 'b.nc') return null;
      return { programEntryName: 'A', symbols: [], calls: [] };
    }
  });
  // null index 的文件被过滤掉，不进入 entries
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].file.path, 'a.nc');
});

test('collectNavigationIndexEntries concurrency defaults to 1 for invalid values', async () => {
  const files = [{ path: 'a.nc' }, { path: 'b.nc' }];
  const loaded = [];
  // concurrency=0 / -1 / NaN 都应回退到串行 workerCount=1
  for (const concurrency of [0, -1, NaN]) {
    loaded.length = 0;
    const entries = await collectNavigationIndexEntries(files, {
      getFilePath: f => f.path,
      concurrency,
      isCancelled: () => false,
      async loadIndex(file) {
        loaded.push(file.path);
        return { programEntryName: file.path, symbols: [], calls: [] };
      }
    });
    assert.strictEqual(entries.length, 2, `concurrency=${concurrency} should still process all files`);
  }
});
