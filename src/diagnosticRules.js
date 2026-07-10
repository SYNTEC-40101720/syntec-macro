function createLineRule(id, validate) {
  return Object.freeze({ id, validate });
}

function runLineRules(rules, lineContext, lineNum, lineStartInBlock) {
  const diagnostics = [];
  for (const rule of rules) {
    diagnostics.push(...rule.validate(lineContext.raw, lineNum, lineStartInBlock, lineContext.clean));
  }
  return diagnostics;
}

function getRuleIds(rules) {
  return rules.map(rule => rule.id);
}

module.exports = {
  createLineRule,
  getRuleIds,
  runLineRules
};