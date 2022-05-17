'use strict';

/**
 * @enum {string}
 */
const ModuleType = {
  // A script file that contains goog.module.
  GOOG: 'goog.module',
  // ECMAScript module.
  ES: 'es',
  // CommonJS module.
  COMMONJS: 'commonjs',
  // A script file that contains goog.provide.
  PROVIDE: 'goog.provide',
  // A script file that does not contains goog.provide or goog.module.
  SCRIPT: 'script'
};

module.exports = ModuleType;
