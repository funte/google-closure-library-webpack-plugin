'use strict';

const _fs = require('fs-extra');
const path = require('path');
const { isAbsolute } = require('slim-pig').pattern;

/**
 * Find the node_modules directory.
 * @param {string} pattern Absolute pattern to start search, defaults to current directory.
 * @param {any} [fs] User provided file system, defaults to fs-extra.
 * @returns {string | null} Return null if not found.
 */
const findNodeModules = (pattern, fs = _fs) => {
  if (typeof pattern !== 'string' || pattern === '') {
    pattern = __dirname;
  }

  const NODE_MODULES = 'node_modules';
  pattern = path.normalize(pattern);

  const segments = pattern.split(path.sep);
  let index = segments.indexOf(NODE_MODULES);
  if (-1 !== index) {
    return segments.slice(0, index + 1).join(path.sep);
  }

  try {
    const stat = fs.statSync(pattern);
    if (!stat.isDirectory()) {
      pattern = path.dirname(pattern);
    }

    let lastPattern = '';
    while (pattern !== lastPattern) {
      // Find node_modules in current.
      for (const dirent of fs.readdirSync(pattern, { withFileTypes: true })) {
        if (dirent.isDirectory() && dirent.name === NODE_MODULES) {
          const nodeModules = pattern + path.sep + NODE_MODULES;
          // Check whether google-closure-library package exist here.
          if (fs.existsSync(nodeModules + path.sep + 'google-closure-library')) {
            return nodeModules;
          }
        }
      }
      lastPattern = pattern;
      pattern = path.dirname(pattern);
    }
  } catch (err) {
    return null;
  }

  // Nothing found.
  return null;
}

module.exports = findNodeModules;
