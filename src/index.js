const path = require('path');
const fs = require('fs');
const pig = require('slim-pig');
const validateOptions = require('schema-utils');
const schema = require('./schema');
const defaultsDeep = require('lodash.defaultsdeep');
const { GoogModuleMap } = require('./goog-module-map');
const NullFactory = require('webpack/lib/NullFactory');
const GoogRequireParserPlugin = require('./goog-require-parser-plugin');
const GoogDependency = require('./dependencies/goog-dependency');
const GoogBaseGlobalDependency = require('./dependencies/goog-base-global');
const GoogLoaderPrefixDependency = require('./dependencies/goog-loader-prefix-dependency');
const GoogLoaderSuffixDependency = require('./dependencies/goog-loader-suffix-dependency');
const GoogLoaderEs6PrefixDependency = require('./dependencies/goog-loader-es6-prefix-dependency');
const GoogLoaderEs6SuffixDependency = require('./dependencies/goog-loader-es6-suffix-dependency');
const GoogleExportsDependency = require('./dependencies/goog-exports-dependency');

const PLUGIN = { name: 'GoogleClosureLibraryWebpackPlugin' };

class GoogleClosureLibraryWebpackPlugin {
  /** 
   * @param {schema} options See `./schema.js`.
   */
  constructor(options) {
    validateOptions(schema, options, { name: 'google-closure-library-webpack-plugin' });
    this.options = defaultsDeep({
      goog: require.resolve('google-closure-library/closure/goog/base.js'),
      sources: [],
      excludes: []
    }, options);
    this.options.goog = path.resolve(this.options.goog);
    const basename = path.basename(this.options.goog);
    if (!fs.existsSync(this.options.goog) || basename !== 'base.js') {
      throw new Error(
        `Unable locate Closure Library base.js file from ${this.options.goog}!!`
      );
    }
    if (this.options.sources.length == 0) {
      throw new Error(`Invalid sources option!!`);
    }

    this.moduleMap = new GoogModuleMap(this.options);
  }

  apply(compiler) {
    // Watch the files change, see https://stackoverflow.com/a/55139759/5906199.
    compiler.hooks.watchRun.tap(PLUGIN, (compiler) => {
      let changedFiles = [];
      // If something removed or directories changed, rebuild the whole module map.
      let rebuild = false;

      for (const filedir of Object.keys(compiler.watchFileSystem.watcher.mtimes)) {
        if (this.moduleMap.fileContext.has(filedir)) {
          if (fs.existsSync(filedir)) {
            const stat = fs.statSync(filedir);
            if (stat.isFile()) {
              // File changed, record it.
              changedFiles.push(filedir);
            } else if (stat.isDirectory()) {
              // Directory changed, nedd rebuild.
              rebuild = true;
              break;
            }
          } else {
            // Directory or file removed, need rebuild.
            rebuild = true;
            break;
          }
        }
      }
      if (rebuild) {
        this.moduleMap.scan();
      } else {
        // Just update some modules.
        changedFiles.forEach(file => {
          this.moduleMap.updateModule(file);
        });
      }
    });

    // Add wacting files, see https://stackoverflow.com/a/35721696/5906199.
    compiler.hooks.afterCompile.tap(PLUGIN, compilation => {
      this.moduleMap.filesToWatch().forEach(file => {
        compilation.fileDependencies.add(file);
      });
      this.moduleMap.directoriesToWatch().forEach(dir => {
        compilation.contextDependencies.add(dir);
      });
    });

    compiler.hooks.compilation.tap(PLUGIN, (compilation, params) => {
      var { normalModuleFactory } = params;

      const parserCallback = (parser, options) => {
        new GoogRequireParserPlugin(PLUGIN, this.moduleMap).apply(parser);
      };

      normalModuleFactory.hooks.parser
        .for('javascript/auto')
        .tap(PLUGIN.name, parserCallback);
      normalModuleFactory.hooks.parser
        .for('javascript/dynamic')
        .tap(PLUGIN.name, parserCallback);
      normalModuleFactory.hooks.parser
        .for('javascript/esm')
        .tap(PLUGIN.name, parserCallback);

      compilation.dependencyFactories.set(
        GoogDependency,
        params.normalModuleFactory
      );
      compilation.dependencyTemplates.set(
        GoogDependency,
        new GoogDependency.Template()
      );

      compilation.dependencyFactories.set(
        GoogBaseGlobalDependency,
        params.normalModuleFactory
      );
      compilation.dependencyTemplates.set(
        GoogBaseGlobalDependency,
        new GoogBaseGlobalDependency.Template()
      );

      compilation.dependencyFactories.set(
        GoogLoaderPrefixDependency,
        params.normalModuleFactory
      );
      compilation.dependencyTemplates.set(
        GoogLoaderPrefixDependency,
        new GoogLoaderPrefixDependency.Template()
      );

      compilation.dependencyFactories.set(
        GoogLoaderSuffixDependency,
        params.normalModuleFactory
      );
      compilation.dependencyTemplates.set(
        GoogLoaderSuffixDependency,
        new GoogLoaderSuffixDependency.Template()
      );

      compilation.dependencyFactories.set(
        GoogLoaderEs6PrefixDependency,
        new NullFactory()
      );
      compilation.dependencyTemplates.set(
        GoogLoaderEs6PrefixDependency,
        new GoogLoaderEs6PrefixDependency.Template()
      );

      compilation.dependencyFactories.set(
        GoogLoaderEs6SuffixDependency,
        new NullFactory()
      );
      compilation.dependencyTemplates.set(
        GoogLoaderEs6SuffixDependency,
        new GoogLoaderEs6SuffixDependency.Template()
      );

      compilation.dependencyFactories.set(
        GoogleExportsDependency,
        new NullFactory()
      );
      compilation.dependencyTemplates.set(
        GoogleExportsDependency,
        new GoogleExportsDependency.Template()
      );
    });
  }
}

module.exports = GoogleClosureLibraryWebpackPlugin;
