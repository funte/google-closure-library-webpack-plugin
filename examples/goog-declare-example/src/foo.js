/* Reference Closure file from ES6 module. */

// Associates an ES6 module with a goog module id 'Foo', so that is available
// required by `goog.require`.
goog.declareModuleId('Foo');
// `goog.require` with a return value just work in goog module.
var Bar = goog.require('Bar');
// Export Bar as default in ES6 module.
export default Bar;