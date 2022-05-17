// Its a SCRIPT module which does not contains goog.provide or goog.module.

goog.require('goog.dom');
// Require a PROVIDE module in SCRIPT module. 
// The transformed code like this with default target option:
//  import "./a.js";
//  const message = goog.global.a.Message();
const message = goog.require('a').Message();

// Show the hello message.
const div = goog.dom.createElement('div');
div.appendChild(
  goog.dom.createTextNode(message)
);
document.body.appendChild(div);
