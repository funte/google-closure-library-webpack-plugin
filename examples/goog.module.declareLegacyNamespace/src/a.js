// Its legacy GOOG module which contains goog.module.declareLegacyNamespace.

// !!One file only could has on goog.module, and its must be first line.
goog.module('a');

// !!This will expose globally accessible object a in the goog.global and allow
// you require this module in PROVIDE module.
goog.module.declareLegacyNamespace();

goog.require('goog.string');

// Export Message function.
// This line will be transformed to:
//  var exports = {};
//  exports.Message = () => goog.string.collapseWhitespace('Hello         World!!');
//  export default exports;
exports.Message = () => goog.string.collapseWhitespace('Hello         World!!');
