'use strict';

const { StringFormatter } = require('slim-pig').str;

const PluginError = require('./PluginError');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class ModifyRequiredNamespaceWarning extends PluginError {
  /**
   * @param {string} file
   * @param {SourceLocation} loc
   * @param {string} namespace
   * @param {string} [desc] Optional description.
   */
  constructor(file, loc, namespace, desc) {
    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Modify required namespace ${'namespace'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Modify required namespace ${'namespace'} at file ${'file'}:${'line'}:${'column'}.`;
    super(formatter, file, loc, { namespace, desc });

    this.name = 'ModifyRequiredNamespaceWarning';
    Error.captureStackTrace(this, this.constructor);
  }
};
