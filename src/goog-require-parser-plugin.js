const GoogDependency = require('./dependencies/goog-dependency');
const GoogBaseGlobalDependency = require('./dependencies/goog-base-global');
const GoogLoaderPrefixDependency = require('./dependencies/goog-loader-prefix-dependency');
const GoogLoaderSuffixDependency = require('./dependencies/goog-loader-suffix-dependency');
const GoogLoaderEs6PrefixDependency = require('./dependencies/goog-loader-es6-prefix-dependency');
const GoogLoaderEs6SuffixDependency = require('./dependencies/goog-loader-es6-suffix-dependency');
const GoogleExportsDependency = require('./dependencies/goog-exports-dependency');

class GoogRequireParserPlugin {

  constructor(PLUGIN, moduleMap) {
    this.PLUGIN = PLUGIN;
    this.moduleMap = moduleMap;
  }

  apply(parser) {
    // support goog.require and goog.provide
    const googRequireProvideCallback = (expr) => {
      this.initGoog(parser);

      if (expr.callee.property.name === 'provide') {
        if (!parser.state.current.hasDependencies(
          (dep) => dep instanceof GoogLoaderPrefixDependency)
        ) {
          this.addLoaderDependency(parser, false);
        }
      } else {
        const current = this.moduleMap.requireModuleByPath(parser.state.current.request);
        const required = this.moduleMap.requireModuleByName(expr.arguments[0].value);
        this.addGoogDependency(parser, required.path, false, 
          current.isGoogModule === false ? {
          start: expr.start,
          end: expr.end - 1 // not include ';' or '.' after the goog.require
        }: null);
      }
    };
    parser.hooks.call
      .for('goog.require')
      .tap(this.PLUGIN, googRequireProvideCallback);
    parser.hooks.call
      .for('goog.provide')
      .tap(this.PLUGIN, googRequireProvideCallback);

    // expose goog object
    parser.hooks.statement.tap(this.PLUGIN, (expr) => {
      if (
        expr.type === 'VariableDeclaration' &&
        expr.declarations.length === 1 &&
        expr.declarations[0].id.name === 'goog' &&
        parser.state.current &&
        parser.state.current.userRequest === this.moduleMap.basePath
      ) {
        parser.state.current.addDependency(new GoogBaseGlobalDependency());
      }
    });

    // support goog.module in goog module system.
    parser.hooks.call.for('goog.module').tap(this.PLUGIN, (expr) => {
      this.initGoog(parser);

      const prefixDep = parser.state.current.dependencies.find(
        (dep) => dep instanceof GoogLoaderPrefixDependency);
      const suffixDep = parser.state.current.dependencies.find(
        (dep) => dep instanceof GoogLoaderPrefixDependency);
      if (prefixDep && suffixDep) {
        prefixDep.isGoogModule = true;
        suffixDep.isGoogModule = true;
      } else {
        this.addLoaderDependency(parser, true);
      }
    });

    // support Closure module exports.
    // must after goog.module parsed, just work in Closure module.
    parser.hooks.assign.for('exports').tap(this.PLUGIN, (expr) => {
      const prefixDep = parser.state.current.dependencies.find(
        (dep) => dep instanceof GoogLoaderPrefixDependency);
      if (prefixDep && prefixDep.isGoogModule) {
        parser.state.current.addDependency(
          new GoogleExportsDependency(parser, expr.left.range)
        );
      }
    });

    // support goog.declareModuleId.
    const googModuleDeclareCallback = () => {
      this.initGoog(parser);

      parser.state.current.addVariable(
        '$jscomp',
        'window.$jscomp = window.$jscomp || {}',
        []
      );

      this.addEs6LoaderDependency(parser);
    };
    parser.hooks.call
      .for('goog.declareModuleId')
      .tap(this.PLUGIN, googModuleDeclareCallback);

    parser.hooks.import.tap(this.PLUGIN, () => {
      parser.state.current.addVariable(
        '$jscomp',
        'window.$jscomp = window.$jscomp || {}',
        []
      );
      this.addEs6LoaderDependency(parser);
    });
    parser.hooks.export.tap(this.PLUGIN, () => {
      parser.state.current.addVariable(
        '$jscomp',
        'window.$jscomp = window.$jscomp || {}',
        []
      );
      this.addEs6LoaderDependency(parser);
    });
  }

  initGoog(parser) {
    if (!parser.state.current.hasDependencies(
      (dep) => dep.request === this.moduleMap.basePath)
    ) {
      this.addGoogDependency(parser, this.moduleMap.basePath, true);
    }
  }

  addGoogDependency(parser, request, addAsBaseJs, stripOpt) {
    parser.state.current.addDependency(
      new GoogDependency(
        request, addAsBaseJs ? -2 : -1, addAsBaseJs, stripOpt
      ));
  }

  addLoaderDependency(parser, isGoogModule) {
    parser.state.current.addDependency(new GoogLoaderPrefixDependency(
      parser.state.current.request, isGoogModule, 0
    ));
    const sourceLength = parser.state.current._source.source().length;
    parser.state.current.addDependency(new GoogLoaderSuffixDependency(
      parser.state.current.request, isGoogModule, sourceLength
    ));
  }

  addEs6LoaderDependency(parser) {
    if (parser.state.current.dependencies.some(
      (dep) => dep instanceof GoogLoaderEs6PrefixDependency)
    ) {
      return;
    }

    parser.state.current.addDependency(new GoogLoaderEs6PrefixDependency(
      0
    ));
    parser.state.current.addDependency(new GoogLoaderEs6SuffixDependency(
      parser.state.current._source.source().length
    ));
  }
}

module.exports = GoogRequireParserPlugin;
