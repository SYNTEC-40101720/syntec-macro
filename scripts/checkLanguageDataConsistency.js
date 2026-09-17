const { functions } = require('../src/functions');
const { keywords, keywordDocs } = require('../src/keywords');
const { DiagnosticCode } = require('../src/diagnosticCodes');
const {
  DIAGNOSTIC_HELP,
  DIAGNOSTIC_REPLACEMENTS
} = require('../src/diagnosticActions');

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function checkLanguageDataConsistency() {
  const errors = [];
  const functionNames = functions.map(fn => fn.name);
  for (const duplicate of duplicateValues(functionNames)) {
    errors.push(`Duplicate built-in function definition: ${duplicate}`);
  }
  for (const fn of functions) {
    if (!/^[A-Z][A-Z0-9]*$/.test(fn.name || '')) {
      errors.push(`Built-in function name must be uppercase: ${fn.name || '(missing)'}`);
    }
    if (!fn.sig || !fn.doc) {
      errors.push(`Built-in function ${fn.name || '(missing)'} must include sig and doc.`);
    }
  }

  for (const [groupName, values] of Object.entries(keywords)) {
    for (const duplicate of duplicateValues(values)) {
      errors.push(`Duplicate keyword in ${groupName}: ${duplicate}`);
    }
  }
  for (const keyword of keywords.robot) {
    if (!keywordDocs[keyword]) {
      errors.push(`Robot keyword is missing hover documentation: ${keyword}`);
    }
  }

  const diagnosticCodes = new Set(Object.values(DiagnosticCode));
  for (const code of [
    ...Object.keys(DIAGNOSTIC_HELP),
    ...Object.keys(DIAGNOSTIC_REPLACEMENTS)
  ]) {
    if (!diagnosticCodes.has(code)) {
      errors.push(`Diagnostic metadata references unknown code: ${code}`);
    }
  }

  return errors;
}

function main() {
  const errors = checkLanguageDataConsistency();
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.info('Language data is internally consistent.');
}

if (require.main === module) main();

module.exports = { checkLanguageDataConsistency, duplicateValues };
