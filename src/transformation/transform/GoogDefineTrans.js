'use strict';

const GoogTrans = require('./GoogTrans');

/** @typedef {import('../generate').GenerateContext} GenerateContext */
/** @typedef {import('../../types').ClosureModule} ClosureModule */
/** @typedef {import('../../types').WPReplaceSource} WPReplaceSource */
/** @typedef {import('../../types').DefineParam} DefineParam */

class GoogDefineTrans extends GoogTrans {
  /**
   * @param {ClosureModule} module
   * @param {DefineParam} define
   */
  constructor(module, define) {
    super();

    /** @type {ClosureModule} */
    this.module = module;
    /** @type {DefineParam} */
    this.define = define;
  }

  /**
   * @param {WPReplaceSource} source
   * @param {GenerateContext} generateContext
   * @returns {void}
   */
  apply(source, generateContext) {
    const start = this.define.expr.range[0];
    // Not include the semicolon or LF character.
    let end = this.define.expr.range[1];
    while ([';', '\r', '\n'].includes(this.module.source.charAt(end))) {
      end--;
    }
    source.replace(start, end, this.define.value);
  }
}

module.exports = GoogDefineTrans;
