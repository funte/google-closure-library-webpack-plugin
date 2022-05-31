import goog from './lib';

const div = goog.dom.createElement('div');
div.appendChild(
  goog.dom.createTextNode(goog.string.collapseWhitespace('Hello         World!!'))
);
document.body.appendChild(div);
