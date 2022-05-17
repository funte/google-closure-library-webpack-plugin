'use strict';

const JavascriptParser = require('webpack/lib/javascript/JavascriptParser');

const ClosureModule = require('./ClosureModule');
const ClosureModuleParserPlugin = require('./ClosureModuleParserPlugin');

/** @typedef {import('../types').ClosureTree} ClosureTree */
/** @typedef {import('../types').Environment} Environment */
/** @typedef {import('../types').ExpressionNode} ExpressionNode */
/** @typedef {import('../types').WPJavascriptParser} WPJavascriptParser */

class ClosureModuleFactory {
  constructor() {
    /** @type {WPJavascriptParser} */
    this.parser = undefined;

    /** @type {Error[]} */
    this.errors = [];
    /** @type {Error[]} */
    this.warnings = [];
  }

  /**
   * @param {string} request
   * @param {ClosureTree} tree
   * @param {Environment} env
   * @returns {ClosureModule | null}
   */
  create(request, tree, env) {
    const parser = this.getParser({ tree, env });
    /** @type {ClosureModule} */
    let module = undefined;
    try {
      module = new ClosureModule({ request, tree, env, parser });
    } catch (err) {
      this.errors.push(err);
      module = null;
    }
    return module;
  }

  /**
   * @param {object} options
   * @param {ClosureTree} options.tree
   * @param {Environment} options.env
   * @returns {WPJavascriptParser}
   */
  getParser({ tree, env }) {
    if (this.parser === undefined) {
      this.parser = new JavascriptParser();

      new ClosureModuleParserPlugin({ tree, env }).apply(this.parser);
    }

    return this.parser;
  }
}

module.exports = ClosureModuleFactory;
