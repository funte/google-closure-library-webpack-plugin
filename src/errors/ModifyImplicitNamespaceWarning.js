'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class ModifyImplicitNamespaceWarning extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} namespace
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, namespace, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Modify implicitly constructed namespace ${'namespace'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Modify implicitly constructed namespace ${'namespace'} at file ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { namespace, desc });

    this.name = 'ModifyImplicitNamespaceWarning';
    Error.captureStackTrace(this, this.constructor);
  }
};
