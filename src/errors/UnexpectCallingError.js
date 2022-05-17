'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class UnexpectCallingError extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} name Closure function name.
   * @param {string} where
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, name, where, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Unexpect ${'name'} in ${'where'} ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Unexpect ${'name'} in ${'where'} ${'file'}:${'line'}:${'column'}.`
    super(formatter, file, loc, { name, where, desc });

    this.name = 'UnexpectCallingError';
    Error.captureStackTrace(this, this.constructor);
  }
};
