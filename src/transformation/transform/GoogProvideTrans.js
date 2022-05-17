'use strict';

const GoogTrans = require('./GoogTrans');
const ModuleType = require('../../closure/ModuleType');
const { getExportStatement } = require('../template');

/** @typedef {import('../generate').GenerateContext} GenerateContext */
/** @typedef {import('../../types').ClosureModule} ClosureModule */
/** @typedef {import('../../types').WPReplaceSource} WPReplaceSource */
/** @typedef {import('../../types').ProvideInfo} ProvideInfo */

/**
 * Transform goog.module/provide/declareModuleId/declareNamespace expression,
 * and add export statement.
 */
class GoogProvideTrans extends GoogTrans {
  /**
   * @param {ClosureModule} module
   * @param {ProvideInfo} info
   */
  constructor(module, info) {
    super();

    /** @type {ClosureModule} */
    this.module = module;
    /** @type {ProvideInfo} */
    this.info = info;
  }

  /**
   * @param {WPReplaceSource} source
   * @param {GenerateContext} generateContext
   * @returns {void}
   */
  apply(source, generateContext) {
    const namespace = this.info.namespace;

    if (this.info.statement) {
      // Clear the provide statement.
      let end = this.info.statement.range[1];
      // Back the end position until semicolon or LF character.
      while (![';', '\r', '\n'].includes(this.module.source.charAt(end))) {
        end--;
      }
      source.replace(this.info.statement.range[0], end, '');
    }

    // Clear the goog.module.declareLegacyNamespace statement.
    if (this.module.legacy) {
      let end = this.module.legacy.range[1];
      // Back the end position until semicolon or LF character.
      while (![';', '\r', '\n'].includes(this.module.source.charAt(end))) {
        end--;
      }
      source.replace(this.module.legacy.range[0], end, '');
    }

    // Construct provided and implicit namespaces in this module.
    // Here use spread "a = a||{}; a.b = a.b||{}; a.b.c = {};" assignments 
    // instead the goog.exportPath_ to construct the namespaces, these 
    // transformation should not rely on any goog API.
    /** @type {string[]} */
    const chunk = [];
    const isPROVIDEModule = this.module.type === ModuleType.PROVIDE;
    const isGOOGModule = this.module.type === ModuleType.GOOG;
    // Add associated local variable declaration.
    if (isGOOGModule && this.info.declaration === undefined) {
      chunk.push(`var exports = {};\n`);
    }
    // Construct implicit namespaces.
    if (isPROVIDEModule || this.module.legacy) {
      const prefix = generateContext.tree.isLibraryModule(this.module.request)
        ? ''
        : 'goog.global.';
      for (let implicitNamespace of this.info.implicities) {
        implicitNamespace = `${prefix}${implicitNamespace}`;
        // Implicit namespace maybe intialized in required module, its must be 
        // checked first.
        chunk.push(`/** construct implicit namespace ${implicitNamespace} */${implicitNamespace} = ${implicitNamespace} || {};\n`);
      }
      // Construct provided namespace.
      const providedNamespace = `${prefix}${namespace}`;
      if (isPROVIDEModule) {
        // The Webpack internal HarmonyImportDependency insert transformed import
        // statement at stage STAGE_HARMONY_IMPORTS, this will break the order 
        // with other construct namespace statements. 
        // So, the provided namespace must be intialized like the implicit namespace.
        // chunk.push(`/** construct provided ${_namespace} */${_namespace} = {};\n`);
        chunk.push(`/** construct provided namespace ${providedNamespace} */${providedNamespace} = ${providedNamespace} || {};\n`);
      } else if (this.module.legacy) {
        chunk.push(`${providedNamespace} = ${this.info.id};\n`);
      }
    }
    // Insert chunk to source.
    if (chunk.length > 0) {
      const chunkPosition = isGOOGModule && this.info.declaration !== undefined
        ? this.info.declaration.range[1]
        : this.info.expr.range[1];
      source.insert(chunkPosition, chunk.join(''));
    }

    // Append transformed export statement.
    if (namespace === 'goog' || isGOOGModule) {
      const exportStatement = getExportStatement(
        this.module, this.info.id, generateContext.env.target
      );
      source.insert(this.module.source.length, exportStatement);
    }
  }
}

module.exports = GoogProvideTrans;
