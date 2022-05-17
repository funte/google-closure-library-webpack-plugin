'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').ModuleType} ModuleType */

module.exports = class MixedModuleTypeError extends PluginError {
  /**
   * @param {string} file
   * @param {ModuleType} currentType
   * @param {ModuleType} targetType
   * @param {string} [desc] Optional description.
   */
  constructor(file, currentType, targetType, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Type of module ${'file'} cannot be both ${'a'} and ${'b'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Type of module ${'file'} cannot be both ${'a'} and ${'b'}.`;
    super(formatter, file, undefined, {
      a: currentType,
      b: targetType,
      desc
    });

    this.name = 'MixedModuleTypeError';
    Error.captureStackTrace(this, this.constructor);
  }
};
