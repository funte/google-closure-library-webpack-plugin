'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class NamespaceConflictError extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} namespace
   * @param {string} what
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, namespace, what, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Namespace ${'namespace'} conflict with ${'what'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Namespace ${'namespace'} conflict with ${'what'} at file ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { namespace, what, desc });

    this.name = 'NamespaceConflictError';
    Error.captureStackTrace(this, this.constructor);
  }
};
