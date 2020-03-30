const ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');

class GoogLoaderPrefixDependency extends ModuleDependency {
  constructor(request, isGoogModule, insertPosition) {
    super(request);
    this.insertPosition = insertPosition;
    this.isGoogModule = isGoogModule;
  }

  get type() {
    return 'goog loader prefix';
  }

  updateHash(hash) {
    hash.update(this.insertPosition + '');
    hash.update(this.isGoogModule + '');
  }
}

GoogLoaderPrefixDependency.Template = class GoogLoaderPrefixDependencyTemplate {
  apply(dep, source) {
    if (dep.insertPosition === null) {
      return;
    }
    let content = `var googPreviousLoaderState__ = goog.moduleLoaderState_;\n`;
    if (dep.isGoogModule) {
      content += `goog.moduleLoaderState_ = {
  moduleName: '',
  declareLegacyNamespace: false,
  type: goog.ModuleType.GOOG
};
goog.loadModule(function() {\n`;
    } else {
      content += `goog.moduleLoaderState_ = null;\n`;
    }
    source.insert(dep.insertPosition, content);
  }
}

module.exports = GoogLoaderPrefixDependency;