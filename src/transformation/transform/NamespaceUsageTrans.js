'use strict';

const GoogTrans = require('./GoogTrans');

/** @typedef {import('../generate').GenerateContext} GenerateContext */
/** @typedef {import('../../types').ExpressionNode} ExpressionNode */
/** @typedef {import('../../types').WPReplaceSource} WPReplaceSource */
/** @typedef {import('../../types').RequireInfo} RequireInfo */

class NamespaceUsageTrans extends GoogTrans {
  /**
   * @param {string} namespace
   * @param {ExpressionNode[]} exprs
   */
  constructor(namespace, exprs) {
    super();

    /** @type {string} */
    this.namespace = namespace;
    /** @type {ExpressionNode[]} */
    this.exprs = exprs;
  }

  /**
   * @param {WPReplaceSource} source
   * @param {GenerateContext} generateContext
   * @returns {void}
   */
  apply(source, generateContext) {
    for (const expr of this.exprs) {
      source.insert(expr.range[0], `/** use namespace ${this.namespace} */goog.global.`);
    }
  }
}

module.exports = NamespaceUsageTrans;
