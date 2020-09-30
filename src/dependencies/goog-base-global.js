// 1. expose goog object in base.js as property of the global window object;
// 2. return goog object support webpack require;
// 3. disable debug loader;

const Dependency = require('webpack/lib/Dependency');

class GoogBaseGlobalDependency extends Dependency { }

GoogBaseGlobalDependency.Template = class GoogBaseGlobalDependencyTemplate {
  apply(dep, source) {
    const sourceContent = source.source();

    const content = `
COMPILED = true;
goog.ENABLE_DEBUG_LOADER = false;
module.exports = goog;`;
    source.insert(sourceContent.length, content);

    const start = sourceContent.search(/\s*goog\.global\s*=\s*/);
    const end = sourceContent.indexOf(';', start);
    if (start && end) {
      const defination = `
goog.global = window;
goog.global.CLOSURE_NO_DEPS = true;
window.goog = goog;`;
      source.replace(start, end, defination);
    } else {
      throw new Error('Variable goog not defined!!');
    }
  }
}

module.exports = GoogBaseGlobalDependency;