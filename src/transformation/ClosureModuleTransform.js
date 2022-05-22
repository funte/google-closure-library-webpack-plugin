'use strict';

const asString = require('../utils/asString');
const createSource = require('./createSource');
const generate = require('./generate');

const GoogDefineTrans = require('./transform/GoogDefineTrans');
const GoogProvideTrans = require('./transform/GoogProvideTrans');
const GoogRequireTrans = require('./transform/GoogRequireTrans');
const NamespaceUsageTrans = require('./transform/NamespaceUsageTrans');

/** @typedef {import('./transform/GoogTrans')} GoogTrans */
/** @typedef {import('../types').ClosureModule} ClosureModule */
/** @typedef {import('../types').ClosureTree} ClosureTree */
/** @typedef {import('../types').Environment} Environment */
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
 * Tranform Closure module to ES or CommonJS module.  
 * @param {object} options 
 * @param {string | Buffer} options.content
 * @param {object} [options.map]
 * @param {ClosureModule} options.module
 * @param {ClosureTree} options.tree
 * @param {Environment} options.env
 * @returns {WPSource}
 */
const transform = ({ content, map, module, tree, env }) => {
  // If the source has change, reload and parse again.
  if (module.source !== asString(content)) {
    const tree = module.tree;
    tree.reloadModule(module.request, content);
  }

  const trans = createTransforms(module);
  // Start transform.
  return generate(
    createSource(env.context, module.request, content, map),
    trans,
    { tree, env }
  );
}

module.exports = transform;
