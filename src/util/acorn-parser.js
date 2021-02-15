const fs = require('fs');
const path = require('path');
const acornLoose = require('acorn-loose');

/** 
 * Build an acorn AST.
 * @param {string} source The JavaScript file source.
 * @param {object} opt Parse options.
 *    See https://www.npmjs.com/package/acorn#interface.
 * @return {Node} Acorn AST.
 */
const buildAcornTree = function (source, opt) {
  return acornLoose.parse(source, opt);
};

/** 
 * Walk node tree.
 * @param {function(childNode, node)} findNodeCallback Called when find a child
 *  node.
 * @param {function(node, prop)} shouldStopCallback Called everytime when start 
 *  search current node's property, if return true, stop search.
 */
const walkAcornTree = function (node, findNodeCallback, shouldStopCallback) {
  if (node === null || node === undefined) {
    return;
  }

  findNodeCallback(node, null);

  function innerWalk(node, findNodeCallback, shouldStopCallback) {
    Object.keys(node).forEach(prop => {
      if (shouldStopCallback(node, prop)) {
        return;
      }

      const value = node[prop];
      const valueAsArray = Array.isArray(value) ? value : [value];
      valueAsArray.forEach(childNode => {
        if (typeof childNode.type === 'string') {
          findNodeCallback(childNode, node);
          innerWalk(childNode, findNodeCallback, shouldStopCallback);
        }
      });
    });
  }

  innerWalk(node, findNodeCallback, shouldStopCallback)
};

/** 
 * Find the equality node from acorn ast.
 * @param {Node} node Node from webpack javascriptparse.
 * @param {Node} acornAst Acorn AST build from `buildAcornTree`.
 * @return {Node} null if not found.
 */
const webpackNode2AcornNode = function (node, acornAst) {
  // TODO: Find the equality node from acorn ast.
  throw new Error(`TODO: Find the equality node from acorn ast.`);
}

module.exports = {
  buildAcornTree: buildAcornTree,
  walkAcornTree: walkAcornTree,
  webpackNode2AcornNode: webpackNode2AcornNode
};
