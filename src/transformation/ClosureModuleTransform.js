'use strict';

const { OriginalSource, SourceMapSource } = require('webpack-sources');
const { contextify } = require('webpack/lib/util/identifier');

const asBuffer = require('../utils/asBuffer');
const asString = require('../utils/asString');
const generate = require('./generate');

const GoogDefineTrans = require('./transform/GoogDefineTrans');
const GoogProvideTrans = require('./transform/GoogProvideTrans');
const GoogRequireTrans = require('./transform/GoogRequireTrans');
const NamespaceUsageTrans = require('./transform/NamespaceUsageTrans');

/** @typedef {import('./transform/GoogTrans')} GoogTrans */
/** @typedef {import('../types').ClosureModule} ClosureModule */
/** @typedef {import('../types').ClosureTree} ClosureTree */
/** @typedef {import('../types').Environment} Environment */
/** @typedef {import('../types').WPCompilation} WPCompilation */
/** @typedef {import('../types').WPNormalModule} WPNormalModule */
/** @typedef {import('../types').WPSource} WPSource */

/**
 * @param {ClosureModule} module
 * @returns {GoogTrans[]}
 */
const createTransforms = (module) => {
  /** @type {GoogTrans[]} */
  const trans = [];

  // Process require informations.
  // !!Import Closure library namespace goog first.
  if (module.requires.has('goog')) {
    trans.push(new GoogRequireTrans(module, module.requires.get('goog')));
  }
  for (const [namespace, info] of module.requires.entries()) {
    if (namespace === 'goog') { continue; }
    trans.push(new GoogRequireTrans(module, info));
  }

  // Process provide informations.
  for (const [, info] of module.provides.entries()) {
    trans.push(new GoogProvideTrans(module, info));
  }

  // Process provided, required and implicit namespace usages.
  for (const [namespace, exprs] of module.namespaceUsages.entries()) {
    trans.push(new NamespaceUsageTrans(namespace, exprs));
  }

  // Process goog.define.
  for (const [, define] of module.defines.entries()) {
    trans.push(new GoogDefineTrans(module, define));
  }
  return trans;
}

/**
 * @see https://github.com/webpack/webpack/blob/448ca3d95/lib/NormalModule.js#L97
 * @param {string} context absolute context path
 * @param {object} sourceMap a source map
 * @param {Object=} associatedObjectForCache an object to which the cache will be attached
 * @returns {object} new source map
 */
const contextifySourceMap = (context, sourceMap, associatedObjectForCache) => {
  if (!Array.isArray(sourceMap.sources)) return sourceMap;
  const { sourceRoot } = sourceMap;
  /** @type {function(string): string} */
  const mapper = !sourceRoot
    ? source => source
    : sourceRoot.endsWith("/")
      ? source =>
        source.startsWith("/")
          ? `${sourceRoot.slice(0, -1)}${source}`
          : `${sourceRoot}${source}`
      : source =>
        source.startsWith("/")
          ? `${sourceRoot}${source}`
          : `${sourceRoot}/${source}`;
  const newSources = sourceMap.sources.map(source =>
    contextify(context, mapper(source), associatedObjectForCache)
  );
  return {
    ...sourceMap,
    file: "x",
    sourceRoot: undefined,
    sources: newSources
  };
};

/**
 * Tranform Closure module to ES or CommonJS module.  
 * @param {object} options 
 * @param {string | Buffer} options.content
 * @param {object} [options.map]
 * @param {ClosureModule} options.module
 * @param {ClosureTree} options.tree
 * @param {Environment} options.env
 * @param {WPNormalModule} [options.WPModule]
 * @param {WPCompilation} [options.WPCompilation]
 * @returns {WPSource}
 */
const transform = ({ content, map, module, tree, env, WPModule, WPCompilation }) => {
  // If the source has change, reload and parse again.
  if (module.source !== asString(content)) {
    const tree = module.tree;
    tree.reloadModule(module.request, content);
  }

  /** @type {any} */
  let source = undefined;
  if (WPModule && WPCompilation) {
    source = WPModule.createSource(
      WPCompilation.options.context,
      WPModule.binary ? asBuffer(content) : asString(content),
      map,
      WPCompilation.compiler.root
    );
  } else {
    if (map) {
      source = new SourceMapSource(
        asString(content),
        contextify(env.context, module.request, undefined),
        contextifySourceMap(env.context, map, undefined)
      );
    } else {
      source = new OriginalSource(
        content,
        contextify(env.context, module.request, undefined)
      );
    }
  }
  const trans = createTransforms(module);
  // Start transform.
  return generate(source, trans, { tree, env });
}

module.exports = transform;
