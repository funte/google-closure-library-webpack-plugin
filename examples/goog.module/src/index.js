// Its a SCRIPT module which does not contains goog.provide or goog.module.

goog.require('goog.dom');
// In SCRIPT module, the goog.require will return the local exports object.
// This line will be transformed to:
//  import __a__ from "./a.js";
//  const a = __a__;
const a = goog.require('a');

// Show the hello message.
const div = goog.dom.createElement('div');
div.appendChild(
  goog.dom.createTextNode(a.Message())
);
document.body.appendChild(div);
