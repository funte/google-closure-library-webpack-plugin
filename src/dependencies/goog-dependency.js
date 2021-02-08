const ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');

class GoogDependency extends ModuleDependency {
  /** 
   * @param {boolean} stripOpt.remove if true, remove the goog.require expression.
   * @param {Number} stripOpt.start the start postion. 
   * @param {Number} stripOpt.end the end position.
   */
  constructor(request, insertPosition, isBase, stripOpt) {
    super(request);
    this.insertPosition = insertPosition;
    this.isBase = isBase;
    this.stripOpt = stripOpt;
  }

  get type() {
    return 'goog.require or goog.module.get';
  }

  updateHash(hash) {
    hash.update(this.insertPosition + '');
    hash.update(this.isBase + '');
  }
}

GoogDependency.Template = class GoogDependencyTemplate {
  apply(dep, source) {
    if (dep.insertPosition === null) {
      return;
    }

    let content = `__webpack_require__(${JSON.stringify(dep.module.id)})`;
    if (dep.isBase) {
      content = `var goog = ${content}`;
    }
    content += ';\n';
    source.insert(dep.insertPosition, content);
    if (dep.stripOpt) {
      // Strip the original 'goog.require' statement if need.
      source.replace(dep.stripOpt.start, dep.stripOpt.end, '');
    }
  }
}

module.exports = GoogDependency;