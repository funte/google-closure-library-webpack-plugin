// Its a SCRIPT module which does not contains goog.provide or goog.module.

goog.require('goog.dom');
// This line be transformed to:
//  import * as __a__ from "./a.js";
//  const a = __a__;
const a = goog.require('a');

// Show the hello message.
const div = goog.dom.createElement('div');
div.appendChild(
  goog.dom.createTextNode(a.Message())
);
document.body.appendChild(div);
