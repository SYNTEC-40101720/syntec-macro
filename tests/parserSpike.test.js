// M2 容错 Parser 原型的黄金样例。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  parseMacroDocument,
  tokenizeLine
} = require('../scripts/parserSpike');

test('parser spike tokenizes variables, keywords, operators, and punctuation', () => {
  const tokens = tokenizeLine('IF #1 := 10 THEN');
  assert.deepStrictEqual(
    tokens.map(token => [token.kind, token.text]),
    [
      ['identifier', 'IF'],
      ['variable', '#1'],
      ['operator', ':='],
      ['number', '10'],
      ['identifier', 'THEN']
    ]
  );
});

test('parser spike ignores keywords inside strings and comments', () => {
  const result = parseMacroDocument(
    'MSG("IF END_IF // text"); // IF\n' +
    'IF #1 = 1 THEN\n' +
    'END_IF;'
  );

  assert.deepStrictEqual(result.diagnostics, []);
  assert.deepStrictEqual(result.lines[0].keywords, []);
  assert.strictEqual(result.blocks.length, 1);
});

test('parser spike preserves labels and static calls', () => {
  const result = parseMacroDocument(
    '%@MACRO\n' +
    'N10;\n' +
    'G65 P1000;\n'
  );

  assert.deepStrictEqual(
    result.symbols.map(symbol => [symbol.name, symbol.kind, symbol.line]),
    [['%@MACRO', 'macroHeader', 0], ['N10', 'label', 1]]
  );
  assert.deepStrictEqual(result.calls.map(call => call.targetName), ['G1000']);
});

test('parser spike recovers unmatched and incomplete control flow', () => {
  const result = parseMacroDocument(
    'IF #1 = 1 THEN\n' +
    'END_FOR;\n'
  );

  assert.ok(result.diagnostics.some(item => item.kind === 'unmatched-closer'));
  assert.ok(result.diagnostics.some(item => item.kind === 'unclosed-block'));
  assert.strictEqual(result.blocks[0].keyword, 'IF');
  assert.strictEqual(result.blocks[0].endLine, null);
});

test('parser spike supports REPEAT UNTIL END_REPEAT on one line', () => {
  const result = parseMacroDocument('REPEAT\nUNTIL #1 = 1 END_REPEAT;');
  assert.deepStrictEqual(result.diagnostics, []);
  assert.strictEqual(result.blocks[0].closedBy, 'END_REPEAT');
});
