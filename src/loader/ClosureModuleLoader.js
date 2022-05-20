'use strict';

const asString = require('../utils/asString');
const transform = require('../transformation/ClosureModuleTransform');

/** @typedef {import('../types').ClosureTree} ClosureTree */

/**
 * @param {string | Buffer} content The input content.
 * @param {object} [map] Optional input source map.
 * @param {any} [meta]
 */
const loader = function (content, map, meta) {
  /** @type {ClosureTree} */
  const tree = this.closure ? this.closure.tree : undefined;
  // Do nothing if not Closure module.
  if (tree === undefined || !tree.hasModule(this.resource)) {
    return this.callback(null, content, map, meta);
  }

  let source = undefined;
  try {
    source = transform({
      content,
      map,
      module: tree.getModule(this.resource),
      tree: this.closure.tree,
      env: this.closure.env,
      WPModule: this._module,
      WPCompilation: this._compilation
    });
  } catch (err) {
    tree.errors.push(err);
    return this.callback(null, content, map, meta);
  }

  // Log transformed Closure module.
  if (this.closure.env.logTransformed) {
    const path = require('path');
    const fs = require('fs-extra');
    const output = this._compiler.options.output.path;
    if (!tree.isLibraryModule(this.resource)) {
      if (!fs.existsSync(output)) {
        fs.mkdirpSync(output);
      }
      // @ts-ignore
      fs.writeFileSync(path.resolve(output, `transformed_${path.basename(this.resource)}`), asString(source.source()));
    }
  }

  return this.callback(null, source.source(), source.map(), meta);
}

module.exports = loader;
