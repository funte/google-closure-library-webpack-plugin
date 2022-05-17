'use strict';

const path = require('path');
const NormalModule = require('webpack/lib/NormalModule');

/** @typedef {import('../types').ClosureModule} ClosureModule */
/** @typedef {import('../types').ClosureTree} ClosureTree */
/** @typedef {import('../types').Environment} Environment */

const PLUGIN_NAME = 'GoogleClosureLibraryWebpackPlugin|LoaderPlugin';

/**
 * Add Closure module loader after resolve.
 */
class LoaderPlugin {
  /**
   * @param {object} options
   * @param {ClosureTree} options.tree
   * @param {Environment} options.env
   */
  constructor({ tree, env }) {
    /** @type {ClosureTree} */
    this.tree = tree;
    /** @type {Environment} */
    this.env = env;
    /** 
     * Closure module loaders.
     * @type {string[]} */
    this.moduleLoaders = [
      path.resolve(__dirname, '../loader/ClosureModuleLoader.js')
    ];
  }

  apply(compiler) {
    this._injectLoader(compiler);
    this._injectLoaderContext(compiler);
  }

  _injectLoader(compiler) {
    compiler.hooks.compilation.tap(
      PLUGIN_NAME,
      (compilation, { normalModuleFactory }) => {
        normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, resolveData => {
          const createData = resolveData.createData;
          /** @type {ClosureModule} */
          const module = this.tree.getModule(createData.resource);
          // Stop if not Closure module.
          if (!module) { return; }

          // Add Closure module loaders.
          createData.loaders = this.moduleLoaders.concat(createData.loaders);
        });
      });
  }

  _injectLoaderContext(compiler) {
    compiler.hooks.compilation.tap(
      PLUGIN_NAME,
      (compilation, { normalModuleFactory }) => {
        normalModuleFactory.hooks.module.tap(
          PLUGIN_NAME,
          (module, createData, resolveData) => {
            // Only inject Closure module's loader context.
            if (this.tree.hasModule(module.resource)) {
              const hooks = NormalModule.getCompilationHooks(compilation);
              hooks.beforeLoaders.tap(
                PLUGIN_NAME,
                (loaders, module, loaderContext) => {
                  let closure = loaderContext.closure;
                  if (closure === undefined) {
                    loaderContext.closure = closure = {};
                  }
                  // Intialize the loader context.
                  closure.tree = this.tree;
                  closure.env = this.env;
                }
              );
            }

            return module;
          }
        );
      }
    );
  }
}

module.exports = LoaderPlugin;
