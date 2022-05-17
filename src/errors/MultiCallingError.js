'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

module.exports = class MultiCallingError extends PluginError {
  /**
   * @param {string} file
   * @param {string} name Closure function name.
   * @param {string} [desc] Optional description.
   */
  constructor(file, name, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`${'name'} should only be called once at file ${'file'}, ${'desc'}.`
      : new StringFormatter().setTemplate`${'name'} should only be called once at file ${'file'}.`;
    super(formatter, file, undefined, { name, desc });

    this.name = 'MultiCallingError';
    Error.captureStackTrace(this, this.constructor);
  }
};
