'use strict';

const { ReplaceSource } = require('webpack-sources');

/** @typedef {import('../types').ClosureTree} ClosureTree */
/** @typedef {import('../types').Environment} Environment */
/** @typedef {import('../types').WPSource} WPSource */
/** @typedef {import('./transform/GoogTrans')} GoogTrans */

/**
 * @typedef {object} GenerateContext
 * @property {ClosureTree} tree
 * @property {Environment} env
 */

/**
 * @param {WPSource} originalSource
 * @param {GoogTrans | GoogTrans[]} trans
 * @param {GenerateContext} context
 * @returns {WPSource}
 */
const generate = (originalSource, trans, context) => {
  const source = new ReplaceSource(originalSource);
  for (const item of [].concat(trans || [])) {
    item.apply(source, context);
  }
  return source;
}

module.exports = generate;
