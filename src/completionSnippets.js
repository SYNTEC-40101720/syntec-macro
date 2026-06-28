// Pure helpers for completion snippet text generation.

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFunctionSnippet(fn) {
  const name = fn.name;
  const sig = fn.sig || name;
  const escapedName = escapeRegExp(name);

  if (new RegExp('^' + escapedName + '\\s*\\(\\s*\\)', 'i').test(sig)) {
    return name + '()';
  }

  if (new RegExp('^' + escapedName + '\\s*\\[', 'i').test(sig)) {
    return name + '[${1}]';
  }

  return name + '(${1})';
}

module.exports = {
  buildFunctionSnippet
};
