// Its a ES module.

// Associates this ES module with namespace "a".
goog.declareModuleId('a');

goog.require('goog.string');

// Export Message function.
export function Message() { return goog.string.collapseWhitespace('Hello         World!!'); }
