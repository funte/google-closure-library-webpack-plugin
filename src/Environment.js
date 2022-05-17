'use strict';

const _fs = require('fs-extra');

const findNodeModules = require('./utils/findNodeModules');

class Environment {
  /**
   * @param {object} options
   * @param {string} options.context Used to resolve relative pattern.
   * @param {any} [options.fs] User provided file system, defaults to fs-extra.
   * @param {'esm' | 'commonjs'} [options.target] Closure module transform target, "esm" or "commonjs", defaults to "esm".
   * @param {string} [options.globalObject]
   * @param {any[]} [options.defs] List of string and value to override the goog.define expression, if the name part is omitted, its value will be true.
   * @param {boolean} [options.logTransformed] Enable log transformed Closure module to build directory, defaults to false.
   */
  constructor({ context, fs, target, globalObject, defs, logTransformed }) {
    /** @type {string} */
    this.context = context;
    /** @type {any} */
    this.fs = fs || _fs;
    /** @type {string | null} */
    this.NODE_MODULES = findNodeModules(__dirname, this.fs);
    /** @type {'esm' | 'commonjs'} */
    this.target = 'esm';
    if (typeof target === 'string') {
      const _target = target.toLowerCase();
      this.target = _target === 'commonjs' ? _target : 'esm';
    }
    /** @type {string} */
    this.globalObject = globalObject;

    /** @type {Map<string, string>} */
    this.defs = new Map();
    if (defs && Array.isArray(defs)) {
      for (const def of defs) {
        /** @type {string} */
        let name = undefined;
        /** @type {string} */
        let value = undefined;
        if (typeof def === 'string') {
          name = def;
          value = 'true';
        } else if (Array.isArray(def) && def.length > 0) {
          if (typeof def[0] === 'string') {
            name = def[0];
            if (def.length === 1) {
              value = 'true';
            } else if (def.length === 2) {
              if (typeof def[1] === 'string') {
                value = `"${def[1]}"`;
              } else if (['boolean', 'number', 'function'].indexOf(typeof def[1])
                || def[1] instanceof RegExp
              ) {
                value = def[1].toString();
              }
            }
          }
        }
        if (typeof name === 'string') {
          this.defs.set(name, value);
        }
      }
    }

    /** @type {boolean} */
    this.logTransformed = !!logTransformed;
  }
}

module.exports = Environment;
