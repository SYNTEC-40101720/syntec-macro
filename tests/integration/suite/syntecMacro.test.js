const assert = require('assert');
const path = require('path');
const vscode = require('vscode');

const EXTENSION_ID = 'syntec-team.syntec-macro';
const LANG_ID = 'syntec-macro';

async function waitForDiagnostics(uri, predicate, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (predicate(diagnostics)) return diagnostics;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return vscode.languages.getDiagnostics(uri);
}

async function openSyntecDocument(text) {
  const document = await vscode.workspace.openTextDocument({
    content: text,
    language: LANG_ID
  });
  await vscode.window.showTextDocument(document);
  return document;
}

async function openWorkspaceDocument(relativePath) {
  const document = await vscode.workspace.openTextDocument(path.resolve(__dirname, '..', 'workspace', relativePath));
  await vscode.window.showTextDocument(document);
  return document;
}

const tests = [
  {
    name: 'extension activates for syntec-macro documents',
    run: async () => {
      const document = await openSyntecDocument('%@MACRO\n#1 := 1;');
      const extension = vscode.extensions.getExtension(EXTENSION_ID);

      assert.ok(extension, `${EXTENSION_ID} should be installed in the test host`);
      assert.strictEqual(document.languageId, LANG_ID);

      await extension.activate();
      assert.strictEqual(extension.isActive, true);
    }
  },
  {
    name: 'completion provider returns signature-aware function snippets',
    run: async () => {
      const document = await openSyntecDocument('%@MACRO\nSLEEP');
      const completions = await vscode.commands.executeCommand(
        'vscode.executeCompletionItemProvider',
        document.uri,
        new vscode.Position(1, 5)
      );

      const sleep = completions.items.find(item => item.label === 'SLEEP');
      assert.ok(sleep, 'SLEEP completion should be provided');
      assert.strictEqual(sleep.insertText.value, 'SLEEP()');
    }
  },
  {
    name: 'hover provider returns function documentation',
    run: async () => {
      const document = await openSyntecDocument('%@MACRO\n#1 := ABS(-1);');
      const hovers = await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        document.uri,
        new vscode.Position(1, 7)
      );

      assert.ok(hovers.length > 0, 'ABS hover should be provided');
      assert.ok(String(hovers[0].contents[0].value).includes('ABS(num)'), 'ABS hover should include function signature');
    }
  },
  {
    name: 'hover provider returns G and M code documentation',
    run: async () => {
      const document = await openSyntecDocument('%@MACRO\nG65 P1000;\nM98 P8000;');
      const gHovers = await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        document.uri,
        new vscode.Position(1, 1)
      );
      assert.ok(String(gHovers[0].contents[0].value).includes('G65 P_'), 'G65 hover should include signature');

      const mHovers = await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        document.uri,
        new vscode.Position(2, 1)
      );
      assert.ok(String(mHovers[0].contents[0].value).includes('M98 P_'), 'M98 hover should include signature');
    }
  },
  {
    name: 'document symbol provider returns macro and N labels',
    run: async () => {
      const document = await openSyntecDocument('%@MACRO\nN10;\nM99;');
      const symbols = await vscode.commands.executeCommand(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      assert.ok(symbols.some(symbol => symbol.name === '%@MACRO'), 'macro header symbol should be provided');
      assert.ok(symbols.some(symbol => symbol.name === 'N10'), 'N label symbol should be provided');
    }
  },
  {
    name: 'definition provider resolves GOTO targets',
    run: async () => {
      const document = await openSyntecDocument('%@MACRO\nGOTO 10;\nN10;\nM99;');
      const locations = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        document.uri,
        new vscode.Position(1, 6)
      );

      assert.ok(locations.length > 0, 'GOTO definition should be provided');
      assert.strictEqual(locations[0].range.start.line, 2);
    }
  },
  {
    name: 'definition provider resolves macro and subprogram file calls',
    run: async () => {
      const document = await openWorkspaceDocument('sample.nc');
      const editor = await vscode.window.showTextDocument(document);
      await editor.edit(editBuilder => {
        editBuilder.replace(
          new vscode.Range(0, 0, document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length),
          '%@MACRO\nG66 P1000;\nM98 P8000;\nM198 P8000;'
        );
      });

      const g66Locations = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        document.uri,
        new vscode.Position(1, 6)
      );
      assert.ok(g66Locations[0].uri.fsPath.endsWith('G1000'), 'G66 should resolve to G1000');

      const m98Locations = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        document.uri,
        new vscode.Position(2, 5)
      );
      assert.ok(m98Locations[0].uri.fsPath.endsWith('O8000'), 'M98 should resolve to O8000');

      const m198Locations = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        document.uri,
        new vscode.Position(3, 6)
      );
      assert.ok(m198Locations[0].uri.fsPath.endsWith('O8000'), 'M198 should resolve to O8000');
    }
  },
  {
    name: 'definition provider resolves static string macro calls',
    run: async () => {
      const document = await openWorkspaceDocument('sample.nc');
      const editor = await vscode.window.showTextDocument(document);
      await editor.edit(editBuilder => {
        editBuilder.replace(
          new vscode.Range(0, 0, document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length),
          '%@MACRO\nG65 P"NamedMacro";'
        );
      });

      const locations = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        document.uri,
        new vscode.Position(1, 8)
      );
      assert.ok(locations[0].uri.fsPath.endsWith('NamedMacro'), 'string macro call should resolve to NamedMacro');
    }
  },
  {
    name: 'formatter adjusts indentation conservatively',
    run: async () => {
      const document = await openSyntecDocument('%@MACRO\nIF #1 = 1 THEN   \n#2 := 1;\nEND_IF;');
      const edits = await vscode.commands.executeCommand(
        'vscode.executeFormatDocumentProvider',
        document.uri,
        { insertSpaces: true, tabSize: 4 }
      );

      assert.ok(edits.length > 0, 'formatter should provide edits');
      const workspaceEdit = new vscode.WorkspaceEdit();
      for (const edit of edits) workspaceEdit.replace(document.uri, edit.range, edit.newText);
      await vscode.workspace.applyEdit(workspaceEdit);

      assert.strictEqual(document.getText(), '%@MACRO\nIF #1 = 1 THEN\n    #2 := 1;\nEND_IF;');
    }
  },
  {
    name: 'diagnostics respect enableDiagnostics configuration',
    run: async () => {
      const config = vscode.workspace.getConfiguration('syntecMacro');
      const original = config.get('enableDiagnostics');
      const document = await openSyntecDocument('%@MACRO\nIF #1 = 1 THEN');

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        await new Promise(resolve => setTimeout(resolve, 450));
        let diagnostics = vscode.languages.getDiagnostics(document.uri);
        assert.ok(diagnostics.some(d => d.message.includes('IF 块缺少对应的 END_')), 'diagnostics should be emitted when enabled');

        await config.update('enableDiagnostics', false, vscode.ConfigurationTarget.Global);
        await new Promise(resolve => setTimeout(resolve, 450));
        diagnostics = vscode.languages.getDiagnostics(document.uri);
        assert.strictEqual(diagnostics.length, 0, 'diagnostics should be cleared when disabled');
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  },
  {
    name: 'diagnostics expose semicolon codes and quick fixes',
    run: async () => {
      const config = vscode.workspace.getConfiguration('syntecMacro');
      const original = config.get('enableDiagnostics');
      const document = await openSyntecDocument('%@MACRO\n#1 := 1\nWHILE #1 < 10 DO;\nEND_WHILE;');

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        const diagnostics = await waitForDiagnostics(document.uri, items =>
          items.some(d => d.code === 'SYNTEC_MISSING_SEMICOLON') &&
          items.some(d => d.code === 'SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON')
        );

        const missing = diagnostics.find(d => d.code === 'SYNTEC_MISSING_SEMICOLON');
        const extra = diagnostics.find(d => d.code === 'SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON');
        assert.ok(missing, 'missing semicolon diagnostic code should be emitted');
        assert.ok(extra, 'control structure trailing semicolon diagnostic code should be emitted');

        const missingActions = await vscode.commands.executeCommand(
          'vscode.executeCodeActionProvider',
          document.uri,
          missing.range,
          vscode.CodeActionKind.QuickFix.value
        );
        const insertAction = missingActions.find(action => action.title === '补上行尾 ;');
        assert.ok(insertAction, 'missing semicolon quick fix should be provided');

        const extraActions = await vscode.commands.executeCommand(
          'vscode.executeCodeActionProvider',
          document.uri,
          extra.range,
          vscode.CodeActionKind.QuickFix.value
        );
        const removeAction = extraActions.find(action => action.title === '移除控制结构行尾 ;');
        assert.ok(removeAction, 'trailing semicolon quick fix should be provided');

        await vscode.workspace.applyEdit(insertAction.edit);
        await vscode.workspace.applyEdit(removeAction.edit);
        assert.strictEqual(document.getText(), '%@MACRO\n#1 := 1;\nWHILE #1 < 10 DO\nEND_WHILE;');
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  },
  {
    name: 'unsupported syntax quick fixes replace safe operators',
    run: async () => {
      const config = vscode.workspace.getConfiguration('syntecMacro');
      const original = config.get('enableDiagnostics');
      const document = await openSyntecDocument('%@MACRO\nIF #1 == 1 THEN\nELSIF #2 != 0 THEN\n#3 := 10 DIV 3;\n#4 := 10 % 3;\nIF (#1 = 1) && (#2 = 2) || (#3 EQ 3) THEN\nEND_IF;\nEND_IF;');

      async function applyFirstFixFor(code, title) {
        const diagnostics = await waitForDiagnostics(document.uri, items => items.some(d => d.code === code));
        const diagnostic = diagnostics.find(d => d.code === code);
        assert.ok(diagnostic, `${code} diagnostic should be emitted`);
        const actions = await vscode.commands.executeCommand(
          'vscode.executeCodeActionProvider',
          document.uri,
          diagnostic.range,
          vscode.CodeActionKind.QuickFix.value
        );
        const action = actions.find(item => item.title === title);
        assert.ok(action, `${title} quick fix should be provided; got actions: ${actions.map(item => item.title).join(', ')}; diagnostic code: ${diagnostic.code}; range: ${diagnostic.range.start.line}:${diagnostic.range.start.character}-${diagnostic.range.end.character}`);
        await vscode.workspace.applyEdit(action.edit);
        await new Promise(resolve => setTimeout(resolve, 450));
      }

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_EQUALITY_OPERATOR', '改为 =');
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_ELSIF', '改为 ELSEIF');
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_INEQUALITY_OPERATOR', '改为 <>');
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_DIV', '改为 /');
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_PERCENT_OPERATOR', '改为 MOD');
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_LOGICAL_AND_OPERATOR', '改为 AND');
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_LOGICAL_OR_OPERATOR', '改为 OR');
        await applyFirstFixFor('SYNTEC_UNSUPPORTED_FANUC_COMPARISON', '改为 =');

        assert.strictEqual(document.getText(), '%@MACRO\nIF #1 = 1 THEN\nELSEIF #2 <> 0 THEN\n#3 := 10 / 3;\n#4 := 10 MOD 3;\nIF (#1 = 1) AND (#2 = 2) OR (#3 = 3) THEN\nEND_IF;\nEND_IF;');
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  },
  {
    name: 'unclosed control block quick fix inserts matching closer',
    run: async () => {
      const config = vscode.workspace.getConfiguration('syntecMacro');
      const original = config.get('enableDiagnostics');
      const document = await openSyntecDocument('%@MACRO\nIF #1 = 1 THEN\n#2 := 1;');

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        const diagnostics = await waitForDiagnostics(document.uri, items => items.some(d => d.code === 'SYNTEC_CONTROL_UNCLOSED_BLOCK'));
        const diagnostic = diagnostics.find(d => d.code === 'SYNTEC_CONTROL_UNCLOSED_BLOCK');
        assert.ok(diagnostic, 'unclosed IF diagnostic should be emitted');

        const actions = await vscode.commands.executeCommand(
          'vscode.executeCodeActionProvider',
          document.uri,
          diagnostic.range,
          vscode.CodeActionKind.QuickFix.value
        );
        const action = actions.find(item => item.title === '插入 END_IF;');
        assert.ok(action, `END_IF quick fix should be provided; got actions: ${actions.map(item => item.title).join(', ')}`);

        await vscode.workspace.applyEdit(action.edit);
        assert.strictEqual(document.getText(), '%@MACRO\nIF #1 = 1 THEN\n#2 := 1;\nEND_IF;');
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  }
];

module.exports = { tests };
