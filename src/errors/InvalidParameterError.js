'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class InvalidParameterError extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} param Parameter name.
   * @param {string} [prop] Parameter property name.
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, param, prop, desc) {
    const formatter = typeof prop === 'string'
      ? typeof desc === 'string'
        ? new StringFormatter().setTemplate`Invalid property ${'prop'} of parameter ${'param'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Invalid property ${'prop'} of parameter ${'param'} at file ${'file'}:${'line'}:${'column'}.`
      : typeof desc === 'string'
        ? new StringFormatter().setTemplate`Invalid parameter ${'param'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Invalid parameter ${'param'} at file ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { param, prop, desc });

    this.name = 'InvalidParameterError';
    Error.captureStackTrace(this, this.constructor);
  }
};
