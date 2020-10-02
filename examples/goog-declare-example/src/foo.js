/* reference Closure file from ES6 module. */

// associates an ES6 module with a goog module ID 'Foo' so that is available
// via goog.require.
goog.declareModuleId('Foo');
// goog.require with a return value just work in goog module.
var Bar = goog.require('Bar');
// export Bar as default in ES6 module.
export default Bar;