'use strict';

const { validate } = require('schema-utils');
const webpack = require('webpack');
const ConstDependency = require('webpack/lib/dependencies/ConstDependency');

const ClosureTree = require('./closure/ClosureTree');
const Environment = require('./Environment');
const schema = require('./schema');

const LoaderPlugin = require('./plugins/LoaderPlugin');

/** @typedef {import('./types').ClosureModule} ClosureModule */
/** @typedef {import('./types').PluginError} PluginError */
/** @typedef {import('./types').PluginOptions} PluginOptions */

const PLUGIN_NAME = 'GoogleClosureLibraryWebpackPlugin';

class Plugin {
  /** 
   * @param {PluginOptions} options
   */
  constructor(options) {
    if (!webpack.version) {
      throw new Error('Unknow Webpack version.');
    }
    /** @type {number} */
    const WPMajorVersion = Number(webpack.version.split('.')[0]);
    if (-1 === [4, 5].indexOf(WPMajorVersion)) {
      throw new Error('This plguin only support Webpack4 and 5.');
    }

    if (typeof options !== 'object') {
      options = { sources: [] };
    }
    validate(/** @type {any} */(schema), options, { name: PLUGIN_NAME });

    /** @type {PluginOptions} */
    this.options = options;
    /** @type {Environment} */
    this.env = undefined;
    /** @type {ClosureTree} */
    this.tree = undefined;
  }

  apply(compiler) {
    const globalObject = compiler.options.output && compiler.options.output.globalObject
      ? compiler.options.output.globalObject
      : undefined;
    const logTransformed = this.options.debug ?
      !!this.options.debug.logTransformed
      : false;
    this.env = new Environment({
      context: compiler.options.context,
      fs: compiler.inputFileSystem,
      target: this.options.target,
      globalObject,
      defs: this.options.defs,
      logTransformed
    });

    this.tree = new ClosureTree({
      base: this.options.base,
      sources: this.options.sources,
      env: this.env
    });

    new LoaderPlugin({ tree: this.tree, env: this.env }).apply(compiler);

    const hooks = compiler.hooks;
    hooks.watchRun.tap(PLUGIN_NAME, (compiler) => {
      const patterns = new Set([
        ...(compiler.modifiedFiles || []),
        ...(compiler.removedFiles || [])
      ]);
      if (patterns.size) {
        this.tree.scan(Array.from(patterns));
      }
    });
    hooks.afterCompile.tap(PLUGIN_NAME, compilation => {
      // Add all Closure modules to webpack watch system.
      for (const [request,] of this.tree.requestToModule.entries()) {
        // Skip the Closure library module.
        if (this.tree.isLibraryModule(request)) { continue; }
        compilation.fileDependencies.add(request);
      }
    });
    hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      // Report errors and warnings of Closure tree.
      compilation.hooks.finishModules.tap(PLUGIN_NAME, () => {
        if (this.tree.errors.length > 0) {
          compilation.errors.push(...this.tree.errors);
          this.tree.errors.length = 0;
        }
        if (this.tree.warnings.length > 0) {
          console.log();
          compilation.warnings.push(...this.tree.warnings);
          this.tree.warnings.length = 0;
        }
      });

      const parserHandler = (parser, options) => {
        // Remove all ConstDependency of toplevel this in base.js presentational 
        // dependencies.
        // ISSUE: The source "goog.global = this || self;" in base.js file conflict 
        // with the Webpack internal plugin HarmonyTopLevelThisParserPlugin, 
        // which will add ConstDependency and earse the this value when target 
        // option is "esm".
        const caches = {
          toplevelThisRanges: [] // toplevel this.
        };
        parser.hooks.program.tap(PLUGIN_NAME, () => {
          caches.toplevelThisRanges.length = 0;
        });
        parser.hooks.expression.for('this').tap(PLUGIN_NAME, node => {
          caches.toplevelThisRanges.push(node.range);
        });
        parser.hooks.finish.tap(PLUGIN_NAME, () => {
          const WPModule = parser.state.current;
          /** @type {ClosureModule} */
          const module = this.tree.getModule(WPModule.resource);
          if (!module || !module.isbase) { return; }

          let found = true;
          while (found) {
            found = false;
            for (let i = 0; i < WPModule.presentationalDependencies.length; i++) {
              const dependency = WPModule.presentationalDependencies[i];
              if (dependency instanceof ConstDependency
                && caches.toplevelThisRanges.includes(dependency.range)
              ) {
                WPModule.presentationalDependencies.splice(i, 1);
                found = true;
                break;
              }
            }
          }
        });
      }
      normalModuleFactory.hooks.parser
        .for('javascript/auto')
        .tap(PLUGIN_NAME, parserHandler);
      normalModuleFactory.hooks.parser
        .for('javascript/dynamic')
        .tap(PLUGIN_NAME, parserHandler);
      normalModuleFactory.hooks.parser
        .for('javascript/esm')
        .tap(PLUGIN_NAME, parserHandler);
    });
  }
}

module.exports = Plugin;
