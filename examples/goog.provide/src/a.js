// Its a PROVIDE module which contains goog.provide. 

// This will expose a globally accessible object a in the goog.global.
goog.provide('a');

// Require Closure namespace "goog.string", and then you can direct use the 
// globally accessible object goog.string.
// !!goog.require always return null in PROVIDE module.
goog.require('goog.string');

// Define a Message function in this provided namespace.
a.Message = () => goog.string.collapseWhitespace('Hello         World!!');
