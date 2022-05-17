'use strict';

const GoogTrans = require('./GoogTrans');
const PluginError = require('../../errors/PluginError');
const {
  getRequireVar,
  getRequireIdentifier,
  getRequireStatement
} = require('../template');

/** @typedef {import('../generate').GenerateContext} GenerateContext */
/** @typedef {import('../../types').ClosureModule} ClosureModule */
/** @typedef {import('../../types').WPReplaceSource} WPReplaceSource */
/** @typedef {import('../../types').RequireInfo} RequireInfo */

/**
 * Transform goog.require expression to import statement.
 */
class GoogRequireTrans extends GoogTrans {
  /**
   * @param {ClosureModule} module
   * @param {RequireInfo} info
   */
  constructor(module, info) {
    super();

    /** @type {ClosureModule} */
    this.module = module;
    /** @type {RequireInfo} */
    this.info = info;
  }

  /**
   * @param {WPReplaceSource} source
   * @param {GenerateContext} generateContext
   * @returns {void}
   */
  apply(source, generateContext) {
    const namespace = this.info.namespace;

    /** @type {string | null} */
    let requireVar = undefined;
    /** @type {ClosureModule} */
    const requiredModule = generateContext.tree.getModule(namespace);
    if (!requiredModule) {
      throw new Error(`Unknow namespace ${namespace}.`);
    }
    if (namespace === 'goog') {
      requireVar = 'goog';
    } else {
      if (this.info.confirmed === false) {
        throw new PluginError(
          `Unconfirmed require information of namespace ${namespace}.`
        );
      }
      requireVar = getRequireVar(
        this.module, requiredModule, namespace, this.info
      );

      // If goog.require expression result used, replace it with equivalent identifier.
      if (this.info.used) {
        const start = this.info.expr.range[0];
        // Not include the trailing semicolon, dot and LF character.
        let end = this.info.expr.range[1];
        while ([';', '.', '\r', '\n'].includes(this.module.source.charAt(end))) {
          end--;
        }
        const requireIdentifier = getRequireIdentifier(
          this.module, requiredModule, namespace, this.info
        );
        source.replace(start, end, requireIdentifier);
      }
      // If goog.require expression result not used, clear this statement.
      else {
        let end = this.info.statement.range[1];
        // Back the end position until semicolon or LF character.
        while (![';', '\r', '\n'].includes(this.module.source.charAt(end))) {
          end--;
        }
        source.replace(this.info.statement.range[0], end, '');
      }
    }

    // Insert transformed require statement.
    const requireStatement = getRequireStatement(
      this.module, requiredModule, requireVar, generateContext.env.target
    );
    source.insert(this.info.position, requireStatement);
  }
}

module.exports = GoogRequireTrans;
