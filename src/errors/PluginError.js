'use strict';

const { StringFormatter } = require('slim-pig').str;
const { WebpackError } = require('webpack');

/** @typedef {import('../types').SourceLocation} SourceLocation */

module.exports = class PluginError extends WebpackError {
  /**
   * @param {StringFormatter | string} formatter
   * @param {string} [file]
   * @param {SourceLocation} [loc]
   * @param {any[]} values
   */
  constructor(formatter, file, loc, ...values) {
    /** @type {string} */
    let message = undefined;
    if (typeof formatter === 'string') {
      message = formatter;
    } else if (formatter instanceof StringFormatter) {
      if (typeof file === 'string') {
        let dict = values[values.length - 1];
        if (typeof dict !== 'object') {
          values.push(dict = {});
        }

        let line = 0, column = 0;
        if (typeof loc === 'object'
          && typeof loc.start === 'object'
        ) {
          if (typeof loc.start.line === 'number') {
            line = loc.start.line;
          }
          if (typeof loc.start.column === 'number') {
            column = loc.start.column;
          }
        }
        Object.defineProperties(dict, {
          file: { value: file },
          line: { value: line },
          column: { value: column }
        });
      }

      message = formatter.format(...values);
    } else {
      throw new Error('Parameter formatter must be a string or StringFormatter.');
    }
    super(message);

    this.name = 'GoogleClosureLibraryWebpackPluginError';
    this.file = file;
    Error.captureStackTrace(this, this.constructor);
  }
}
