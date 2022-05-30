import React from 'react';
import ReactDOM from 'react-dom';

// Must import goog first!!
import goog from '../closure/closure/goog/base';
// Import other Closure modules for side effects!!
import '../closure/closure/goog/string/string';

ReactDOM.render(
  <p>{goog.string.collapseWhitespace('Hello         World!!')}</p>,
  document.getElementById('root')
);
