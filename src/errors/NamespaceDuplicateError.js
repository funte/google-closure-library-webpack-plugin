'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class NamespaceDuplicateError extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} namespace
   * @param {boolean} isProvided
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, namespace, isProvided, desc) {
    const formatter = isProvided
      ? typeof desc === 'string'
        ? new StringFormatter().setTemplate`Namespace ${'namespace'} has provided at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Namespace ${'namespace'} has provided at file ${'file'}:${'line'}:${'column'}.`
      : typeof desc === 'string'
        ? new StringFormatter().setTemplate`Namespace ${'namespace'} has required at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Namespace ${'namespace'} has required at file ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { namespace, desc });

    this.name = 'NamespaceDuplicateError';
    Error.captureStackTrace(this, this.constructor);
  }
};
