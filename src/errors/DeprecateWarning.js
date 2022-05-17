'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class DeprecateWarning extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} name Deprecated Closure function or object name.
   * @param {string} alternate Alternative Closure function or object name.
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, name, alternate, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`${'name'} at file ${'file'}:${'line'}:${'column'} has deprecated, please use ${'alternate'}, ${'desc'}.`
      : new StringFormatter().setTemplate`${'name'} at file ${'file'}:${'line'}:${'column'} has deprecated, please use ${'alternate'}.`;
    super(formatter, file, loc, { name, alternate, desc });

    this.name = 'DeprecateWarning';
    Error.captureStackTrace(this, this.constructor);
  }
};

