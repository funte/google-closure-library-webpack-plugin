import path from 'path';
import NormalModule = require('webpack/lib/NormalModule');

import type { ClosureTree } from '../closure/ClosureTree';
import type { Environment } from '../Environment';

export interface LoaderClosureContext {
  tree: ClosureTree,
  env: Environment
}

const PLUGIN_NAME = 'GoogleClosureLibraryWebpackPlugin|LoaderPlugin';

/** Add Closure module loader after resolve. */
export class LoaderPlugin {
  /** Clousre module loaders. */
  public readonly moduleLoaders: string[] = [
    path.resolve(__dirname, '../loader/ClosureModuleLoader.js')
  ];

  constructor(
    public readonly tree: ClosureTree,
    public readonly env: Environment
  ) { }

  apply(compiler: any): void {
    this._injectLoader(compiler);
    this._injectLoaderContext(compiler);
  }

  _injectLoader(compiler: any): void {
    compiler.hooks.compilation.tap(
      PLUGIN_NAME,
      (compilation, { normalModuleFactory }) => {
        normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, resolveData => {
          const createData: any = resolveData.createData;
          if (!createData.resource) { return; }
          const module = this.tree.getModule(createData.resource);
          // Stop if not Closure module.
          if (!module) { return; }

          // Add Closure module loaders.
          // @ts-ignore
          createData.loaders = this.moduleLoaders.concat(createData.loaders);
        });
      });
  }

  _injectLoaderContext(compiler: any): void {
    compiler.hooks.compilation.tap(
      PLUGIN_NAME,
      (compilation, { normalModuleFactory }) => {
        normalModuleFactory.hooks.module.tap(
          PLUGIN_NAME,
          (module, createData, resolveData) => {
            if (module instanceof NormalModule) {
              // Only inject Closure module loader context.
              if (this.tree.hasModule(module.resource)) {
                const hooks = NormalModule.getCompilationHooks(compilation);
                hooks.beforeLoaders.tap(
                  PLUGIN_NAME,
                  (loaders, module, loaderContext) => {
                    // @ts-ignore
                    loaderContext.closure = {
                      tree: this.tree,
                      env: this.env
                    };
                  }
                );
              }
            }
            return module;
          }
        );
      }
    );
  }
}
