'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class NamespaceOutModuleError extends PluginError {
  /**
   * @param {string} file
  * @param {SourceLocation} loc
   * @param {string} namespace
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, namespace, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Using namespace ${'namespace'} outside PROVIDE and legacy GOOG module at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Using namespace ${'namespace'} outside PROVIDE and legacy GOOG module at file ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { namespace });

    this.name = 'NamespaceOutModuleError';
    Error.captureStackTrace(this, this.constructor);
  }
};
