const fs = require('fs');
const acornLoose = require('acorn-loose');

/** 
 * Build an acorn AST.
 * @param {string} modulePath file path to parse.
 * @param {object} opt parse options.
 *    see https://www.npmjs.com/package/acorn#interface.
 * @return {Node} acorn ast.
 */
const buildAcornTree = function (modulePath, opt) {
  const moduleContents = fs.readFileSync(modulePath, 'utf8');
  return acornLoose.parse(moduleContents, opt);
};

/** 
 * Walk node tree.
 * @param {function(childNode, node)} findNodeCallback called when find a child
 *  node.
 * @param {function(node, prop)} stopCallback called when start search current node
 *  node's property, if return true, stop search.
 */
const walkAcornTree = function (node, findNodeCallback, stopCallback) {
  if (node === null || node === undefined) {
    return;
  }

  findNodeCallback(node, null);

  function innerWalk(node, findNodeCallback, stopCallback) {
    Object.keys(node).forEach(prop => {
      if (stopCallback(node, prop)) {
        return;
      }

      const value = node[prop];
      const valueAsArray = Array.isArray(value) ? value : [value];
      valueAsArray.forEach(childNode => {
        if (typeof childNode.type === 'string') {
          findNodeCallback(childNode, node);
          innerWalk(childNode, findNodeCallback, stopCallback);
        }
      });
    });
  }

  innerWalk(node, findNodeCallback, stopCallback)
};

/** 
 * Find the equality node from acorn ast.
 * @param {Node} node node from webpack javascriptparse.
 * @param {Node} acornAst acorn ast get from buildAcornTree.
 * @return {Node} null if not found.
 */
const webpackNode2AcornNode = function(node, acornAst) {
  // TODO: Find the equality node from acorn ast.
  return null;
}

module.exports = {
  buildAcornTree: buildAcornTree,
  walkAcornTree: walkAcornTree,
  webpackNode2AcornNode: webpackNode2AcornNode
};