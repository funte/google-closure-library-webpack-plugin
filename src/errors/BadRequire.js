'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class BadRequire extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Bad goog.require at ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Bad goog.require at ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { desc });

    this.name = 'BadRequire';
    Error.captureStackTrace(this, this.constructor);
  }
};
