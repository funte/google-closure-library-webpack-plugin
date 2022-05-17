'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class MissingParameterError extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} param Parameter name.
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, param, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Missing parameter ${'param'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Missing parameter ${'param'} at file ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { param, desc });

    this.name = 'MissingParameterError';
    Error.captureStackTrace(this, this.constructor);
  }
};
