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

async function waitForDiagnosticCode(uri, code, timeoutMs = 1500) {
  const diagnostics = await waitForDiagnostics(uri, items => items.some(d => d.code === code), timeoutMs);
  const diagnostic = diagnostics.find(d => d.code === code);
  assert.ok(diagnostic, `${code} diagnostic should be emitted`);
  return diagnostic;
}

async function waitForDiagnosticCodeGone(uri, code, timeoutMs = 1500) {
  await waitForDiagnostics(uri, items => !items.some(d => d.code === code), timeoutMs);
  assert.ok(!vscode.languages.getDiagnostics(uri).some(d => d.code === code), `${code} diagnostic should be cleared`);
}

async function getQuickFixAction(document, diagnostic, title) {
  const actions = await vscode.commands.executeCommand(
    'vscode.executeCodeActionProvider',
    document.uri,
    diagnostic.range,
    vscode.CodeActionKind.QuickFix.value
  );
  const action = actions.find(item => item.title === title);
  assert.ok(action, `${title} quick fix should be provided; got actions: ${actions.map(item => item.title).join(', ')}`);
  return action;
}

async function applyQuickFixForCode(document, code, title) {
  const diagnostic = await waitForDiagnosticCode(document.uri, code);
  const action = await getQuickFixAction(document, diagnostic, title);
  await vscode.workspace.applyEdit(action.edit);
  await waitForDiagnosticCodeGone(document.uri, code);
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
    name: 'workspace symbol provider returns static programs and labels',
    run: async () => {
      const openDocumentsBefore = new Set(vscode.workspace.textDocuments.map(document => document.uri.toString()));
      const programs = await vscode.commands.executeCommand(
        'vscode.executeWorkspaceSymbolProvider',
        'G1000'
      );
      assert.ok(programs.some(symbol => symbol.name === 'G1000'), 'G1000 program entry should be provided');

      const labels = await vscode.commands.executeCommand(
        'vscode.executeWorkspaceSymbolProvider',
        'N10'
      );
      assert.ok(labels.some(symbol => symbol.name === 'N10'), 'N10 workspace label should be provided');

      const macroHeaders = await vscode.commands.executeCommand(
        'vscode.executeWorkspaceSymbolProvider',
        '%@MACRO'
      );
      assert.ok(
        macroHeaders.some(symbol => symbol.name === '%@MACRO' && symbol.location.uri.fsPath.endsWith('NamedMacro')),
        'extensionless named macro header should be provided'
      );

      const secondaryPrograms = await vscode.commands.executeCommand(
        'vscode.executeWorkspaceSymbolProvider',
        'G2000'
      );
      assert.ok(
        secondaryPrograms.some(symbol =>
          symbol.name === 'G2000' && symbol.location.uri.fsPath.includes('workspace-secondary')
        ),
        'programs from the secondary workspace root should be provided'
      );

      const secondaryLabels = await vscode.commands.executeCommand(
        'vscode.executeWorkspaceSymbolProvider',
        'N20'
      );
      assert.ok(
        secondaryLabels.some(symbol =>
          symbol.name === 'N20' && symbol.location.uri.fsPath.includes('workspace-secondary')
        ),
        'labels from the secondary workspace root should be provided'
      );

      const locationKeys = macroHeaders.map(symbol =>
        `${symbol.location.uri.toString()}:${symbol.location.range.start.line}:${symbol.name}`
      );
      assert.strictEqual(new Set(locationKeys).size, locationKeys.length, 'workspace symbols should not be duplicated');

      const newlyOpenedDocuments = vscode.workspace.textDocuments
        .filter(document => !openDocumentsBefore.has(document.uri.toString()))
        .filter(document => document.uri.scheme === 'file');
      assert.deepStrictEqual(newlyOpenedDocuments, [], 'workspace symbol scan should not open candidate documents');
    }
  },
  {
    name: 'reference provider finds static macro calls and excludes dynamic targets',
    run: async () => {
      const callsDocument = await openWorkspaceDocument('sample.nc');
      const editor = await vscode.window.showTextDocument(callsDocument);
      await editor.edit(editBuilder => {
        editBuilder.replace(
          new vscode.Range(0, 0, callsDocument.lineCount - 1, callsDocument.lineAt(callsDocument.lineCount - 1).text.length),
          '%@MACRO\nG65 P1000;\nG66.1 P1000;\nG65 P"NamedMacro";\nG65 P#1;\n// G65 P1000;\nM98 P8000;\nM198 P8000;\nM98 P#2;'
        );
      });

      const numericTarget = await openWorkspaceDocument('G1000');
      const numericReferences = await vscode.commands.executeCommand(
        'vscode.executeReferenceProvider',
        numericTarget.uri,
        new vscode.Position(0, 2)
      );
      const numericCallLines = numericReferences
        .filter(location => location.uri.fsPath.endsWith('sample.nc'))
        .map(location => location.range.start.line);
      assert.deepStrictEqual(numericCallLines, [1, 2], 'only static G1000 calls should be returned');

      const callReferences = await vscode.commands.executeCommand(
        'vscode.executeReferenceProvider',
        callsDocument.uri,
        new vscode.Position(1, 6)
      );
      assert.deepStrictEqual(
        callReferences
          .filter(location => location.uri.fsPath.endsWith('sample.nc'))
          .map(location => location.range.start.line),
        [1, 2],
        'reference lookup should work from a static call token'
      );

      const namedTarget = await openWorkspaceDocument('NamedMacro');
      const namedReferences = await vscode.commands.executeCommand(
        'vscode.executeReferenceProvider',
        namedTarget.uri,
        new vscode.Position(0, 2)
      );
      assert.ok(
        namedReferences.some(location => location.uri.fsPath.endsWith('sample.nc') && location.range.start.line === 3),
        'static string macro call should be returned'
      );

      const subprogramTarget = await openWorkspaceDocument('O8000');
      const subprogramReferences = await vscode.commands.executeCommand(
        'vscode.executeReferenceProvider',
        subprogramTarget.uri,
        new vscode.Position(0, 2)
      );
      assert.deepStrictEqual(
        subprogramReferences
          .filter(location => location.uri.fsPath.endsWith('sample.nc'))
          .map(location => location.range.start.line),
        [6, 7],
        'M98 and M198 static calls should reference O8000'
      );
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
        let diagnostics = await waitForDiagnostics(document.uri, items => items.some(d => d.message.includes('IF 块缺少对应的 END_')));
        assert.ok(diagnostics.some(d => d.message.includes('IF 块缺少对应的 END_')), 'diagnostics should be emitted when enabled');

        await config.update('enableDiagnostics', false, vscode.ConfigurationTarget.Global);
        diagnostics = await waitForDiagnostics(document.uri, items => items.length === 0);
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

        const insertAction = await getQuickFixAction(document, missing, '补上行尾 ;');
        const removeAction = await getQuickFixAction(document, extra, '移除控制结构行尾 ;');

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

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_EQUALITY_OPERATOR', '改为 =');
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_ELSIF', '改为 ELSEIF');
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_INEQUALITY_OPERATOR', '改为 <>');
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_DIV', '改为 /');
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_PERCENT_OPERATOR', '改为 MOD');
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_LOGICAL_AND_OPERATOR', '改为 AND');
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_LOGICAL_OR_OPERATOR', '改为 OR');
        await applyQuickFixForCode(document, 'SYNTEC_UNSUPPORTED_FANUC_COMPARISON', '改为 =');

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
        const diagnostic = await waitForDiagnosticCode(document.uri, 'SYNTEC_CONTROL_UNCLOSED_BLOCK');
        const action = await getQuickFixAction(document, diagnostic, '插入 END_IF;');

        await vscode.workspace.applyEdit(action.edit);
        assert.strictEqual(document.getText(), '%@MACRO\nIF #1 = 1 THEN\n#2 := 1;\nEND_IF;');
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  },
  {
    name: 'variable diagnostics expose help actions and assignment style fix',
    run: async () => {
      const config = vscode.workspace.getConfiguration('syntecMacro');
      const original = config.get('enableDiagnostics');
      const document = await openSyntecDocument('%@MACRO\n#TEMP := 1;\n#0 := 2;\nAR-1 := 3;\n#1 = 100;');

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        const diagnostics = await waitForDiagnostics(document.uri, items =>
          items.some(d => d.code === 'SYNTEC_NAMED_LOCAL_VARIABLE') &&
          items.some(d => d.code === 'SYNTEC_VACANT_ASSIGNMENT') &&
          items.some(d => d.code === 'SYNTEC_INVALID_APP_VARIABLE_NUMBER') &&
          items.some(d => d.code === 'SYNTEC_ASSIGNMENT_STYLE_EQUALS')
        );

        for (const code of ['SYNTEC_NAMED_LOCAL_VARIABLE', 'SYNTEC_VACANT_ASSIGNMENT', 'SYNTEC_INVALID_APP_VARIABLE_NUMBER']) {
          const diagnostic = diagnostics.find(d => d.code === code);
          await getQuickFixAction(document, diagnostic, '查看变量规则说明');
        }

        const assignment = diagnostics.find(d => d.code === 'SYNTEC_ASSIGNMENT_STYLE_EQUALS');
        const action = await getQuickFixAction(document, assignment, '改为 :=');
        await vscode.workspace.applyEdit(action.edit);
        assert.strictEqual(document.lineAt(4).text, '#1 := 100;');
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  },
  {
    name: 'static function diagnostics expose help actions',
    run: async () => {
      const config = vscode.workspace.getConfiguration('syntecMacro');
      const original = config.get('enableDiagnostics');
      const document = await openSyntecDocument('%@MACRO\n#1 := ATAN2(0, 0);\n#2 := READDI(512);\nSETDO(3, 2);\nOPEN("COM1");');

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        const diagnostics = await waitForDiagnostics(document.uri, items =>
          items.some(d => d.code === 'SYNTEC_FUNCTION_MATH_DOMAIN') &&
          items.some(d => d.code === 'SYNTEC_FUNCTION_IO_POINT_RANGE') &&
          items.some(d => d.code === 'SYNTEC_FUNCTION_IO_VALUE_RANGE') &&
          items.some(d => d.code === 'SYNTEC_FUNCTION_OPEN_COM_PORT')
        );

        const expected = [
          ['SYNTEC_FUNCTION_MATH_DOMAIN', '查看函数定义域说明'],
          ['SYNTEC_FUNCTION_IO_POINT_RANGE', '查看 I/O 点位范围说明'],
          ['SYNTEC_FUNCTION_IO_VALUE_RANGE', '查看 I/O 写入值说明'],
          ['SYNTEC_FUNCTION_OPEN_COM_PORT', '查看 OPEN COM 说明']
        ];
        for (const [code, title] of expected) {
          const diagnostic = diagnostics.find(d => d.code === code);
          await getQuickFixAction(document, diagnostic, title);
        }
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  },
  {
    name: 'robot syntax quick fixes replace safe forms',
    run: async () => {
      const config = vscode.workspace.getConfiguration('syntecMacro');
      const original = config.get('enableDiagnostics');
      const document = await openSyntecDocument('%@MACRO\nMOVJ X=100. FJ50;\nMOVJ-II X100.;\nTOOLCORON P1;\nTOOLCOR T1;\nTOOLCOR CLEAR;');

      try {
        await config.update('enableDiagnostics', true, vscode.ConfigurationTarget.Global);
        await applyQuickFixForCode(document, 'SYNTEC_ROBOT_DIRECT_ARG_EQUALS', '移除直接引数 =');
        await applyQuickFixForCode(document, 'SYNTEC_ROBOT_DEPRECATED_MOVJ_II', '改为 MOVJ');
        await applyQuickFixForCode(document, 'SYNTEC_ROBOT_TOOLCORON_DEPRECATED', '改为 TOOLCOR');
        await applyQuickFixForCode(document, 'SYNTEC_ROBOT_TOOLCOR_T_ARG', '改为 P 引数');
        await applyQuickFixForCode(document, 'SYNTEC_ROBOT_TOOLCOR_CLEAR', '改为 TOOLCOR P0');

        assert.strictEqual(document.getText(), '%@MACRO\nMOVJ X100. FJ50;\nMOVJ X100.;\nTOOLCOR P1;\nTOOLCOR P1;\nTOOLCOR P0;');
      } finally {
        await config.update('enableDiagnostics', original, vscode.ConfigurationTarget.Global);
      }
    }
  }
];

module.exports = { tests };
