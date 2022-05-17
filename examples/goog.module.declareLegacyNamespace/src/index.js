// Its a PROVIDE module which contains goog.provide.

goog.provide('app');

goog.require('goog.dom');

// Require a legacy GOOG module in PROVIDE module, you can direct use the globally
// accessible object a.
goog.require('a');

// Show the hello message.
const div = goog.dom.createElement('div');
div.appendChild(
  goog.dom.createTextNode(a.Message())
);
document.body.appendChild(div);

