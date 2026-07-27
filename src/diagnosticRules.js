function createLineRule(id, validate) {
  return Object.freeze({ id, validate });
}

function runLineRules(rules, lineContext, lineNum, lineStartInBlock) {
  const diagnostics = [];
  for (const rule of rules) {
    // 单条规则异常不应中断整行诊断
    try {
      diagnostics.push(...rule.validate(lineContext.raw, lineNum, lineStartInBlock, lineContext.clean));
    } catch (err) {
      console.warn(`[syntec-macro] Rule ${rule.id} failed at line ${lineNum}:`, err.message);
    }
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