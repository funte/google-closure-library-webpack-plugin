import { validate } from "schema-utils";
import webpack from 'webpack';
import ConstDependency = require('webpack/lib/dependencies/ConstDependency');

import { ClosureTree } from "./closure/ClosureTree";
import { Environment } from "./Environment";
import { schema } from "./schema";
import { LoaderPlugin } from "./plugins/LoaderPlugin";
import { PluginError } from "./errors/PluginError";

export type TargetOption = 'esm' | 'commonjs';

export type DefineValueType = string | boolean | number;

export type WarningLevelOption = 'show' | 'hideLib' | 'hideUser' | 'hide';

export interface PluginDebugOptions {
  /** Enable log transformed Closure module to build directory, defaults to false. */
  logTransformed?: boolean;
}

export interface PluginOptions {
  /** Path to Closure library base.js file, must be absolute or relative from the environment context. */
  base?: string;
  /** sources List of absolute patterns, or relative from the environment context. */
  sources: string | string[];
  /** Closure module transform target, "esm" or "commonjs", defaults to "esm". */
  target?: TargetOption;
  /** 
   * List of string and value to override the goog.define expression, if the name part is omitted, its value will be true.  
   * The value could be string, boolean and number.  
   */
  defs?: (string | [string] | [string, DefineValueType])[];
  /** "show" show all warnings, "hidelib" hide warnings in Closure library modules and show warnings in user modules, "hideUser" opposite to "hideLib", "hide" hide all warnings, defualts to "hideLib". */
  warningLevel?: WarningLevelOption;
  /**  */
  debug?: PluginDebugOptions;
}

const PLUGIN_NAME = 'GoogleClosureLibraryWebpackPlugin';

export class GoogleClosureLibraryWebpackPlugin {
  public readonly tree: ClosureTree | undefined;
  public readonly env: Environment | undefined;

  constructor(public readonly options: PluginOptions) {
    if (!webpack.version) {
      throw new Error('Unknow Webpack version.');
    }
    const majorVersion = webpack.version.split('.')[0];
    if (-1 === ['4', '5'].indexOf(majorVersion)) {
      throw new Error('This plguin only support Webpack4 and 5.');
    }

    if (typeof options !== 'object') {
      options = { sources: [] };
    }
    validate(schema, options, { name: PLUGIN_NAME });
  }

  apply(compiler: any): void {
    const globalObject = compiler.options.output?.globalObject;
    if (!compiler.options.context) {
      throw new PluginError(`Undefined compiler context option.`);
    }

    const env = (this as any).env = new Environment({
      context: compiler.options.context,
      fs: compiler.inputFileSystem,
      target: this.options.target,
      globalObject,
      defines: this.options.defs,
      warningLevel: this.options.warningLevel,
      logTransformed: this.options.debug?.logTransformed
    });

    const tree = (this as any).tree = new ClosureTree({
      base: this.options.base,
      sources: this.options.sources,
      env
    });

    new LoaderPlugin(tree, env).apply(compiler);

    const hooks = compiler.hooks;
    hooks.watchRun.tap(PLUGIN_NAME, (compiler) => {
      const patterns = new Set([
        ...(compiler.modifiedFiles || []),
        ...(compiler.removedFiles || [])
      ]);
      if (patterns.size) {
        tree.scan(Array.from(patterns));
      }
    });
    hooks.afterCompile.tap(PLUGIN_NAME, compilation => {
      // Add all Closure modules to webpack watch system.
      for (const [request,] of tree.requestToModule.entries()) {
        // Skip the Closure library module.
        if (tree.isLibraryModule(request)) { continue; }
        compilation.fileDependencies.add(request);
      }
    });
    hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      // Report errors and warnings of Closure tree.
      compilation.hooks.finishModules.tap(PLUGIN_NAME, () => {
        if (tree.errors.length > 0) {
          compilation.errors.push(...(tree.errors as any[]));
          tree.errors.length = 0;
        }
        if (tree.warnings.length > 0) {
          console.log();
          compilation.warnings.push(...(tree.warnings as any[]));
          tree.warnings.length = 0;
        }
      });

      const parserHandler = (
        parser: webpack.javascript.JavascriptParser,
        options: any
      ): void => {
        // Remove all ConstDependency of toplevel this in base.js presentational 
        // dependencies.
        // ISSUE: The source "goog.global = this || self;" in base.js file conflict 
        // with the Webpack internal plugin HarmonyTopLevelThisParserPlugin, 
        // which will add ConstDependency and earse the this value when target 
        // option is "esm".
        const toplevelThisRanges: (number | [number, number])[] = []; // toplevel this.
        parser.hooks.program.tap(PLUGIN_NAME, () => {
          toplevelThisRanges.length = 0;
        });
        parser.hooks.expression.for('this').tap(PLUGIN_NAME, node => {
          if (node.range) {
            toplevelThisRanges.push(node.range);
          }
        });
        parser.hooks.finish.tap(PLUGIN_NAME, () => {
          const WPModule: any = parser.state.current;
          const module = tree.getModule(WPModule.resource);
          if (!module || !module.isbase) { return; }
          if (!WPModule.presentationalDependencies
            || WPModule.presentationalDependencies.length === 0
            || toplevelThisRanges.length === 0
          ) { return; }

          let found = true;
          while (found) {
            found = false;
            for (let i = 0; i < WPModule.presentationalDependencies.length; i++) {
              const dependency = WPModule.presentationalDependencies[i];
              if (dependency instanceof ConstDependency
                && toplevelThisRanges.includes(dependency.range)
              ) {
                WPModule.presentationalDependencies.splice(i, 1);
                found = true;
                break;
              }
            }
          }
        });
      };
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
