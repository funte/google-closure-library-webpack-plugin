/* reference ES6 module from Closure file. */

// define a goog module with ID 'App'. 
goog.module('App');
// goog.require with a return value just work in goog module.
var Foo = goog.require('Foo').default;
console.log(Foo);
exports = { Foo };
