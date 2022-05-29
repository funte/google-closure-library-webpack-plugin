// Its GOOG module which contains goog.module.

// !!One file only could has on goog.module, and its must be first line.
// !!goog.module will not expose any globally accessible object. 
goog.module('a');
goog.module.declareLegacyNamespace();

goog.require('goog.string');

// Export Message function.
// This line will be transformed to:
//  var exports = {};
//  exports.Message = () => goog.string.collapseWhitespace('Hello         World!!');
//  export default exports;
exports.Message = () => goog.string.collapseWhitespace('Hello         World!!');
