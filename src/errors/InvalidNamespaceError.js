'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class InvalidNamespaceError extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Invalid namespace at file ${'file'}:${'line'}:${'column'}, namespace and module ID must be dot-separated sequence of a-z, A-Z, 0-9, _ and $, ${'desc'}.`
      : new StringFormatter().setTemplate`Invalid namespace at file ${'file'}:${'line'}:${'column'}, namespace and module ID must be dot-separated sequence of a-z, A-Z, 0-9, _ and $.`;
    super(formatter, file, loc, { desc });

    this.name = 'InvalidNamespaceError';
    Error.captureStackTrace(this, this.constructor);
  }
};
