'use strict';

/**
 * For namespace "a.b.c", the travel order is (a, a) => (b, a.b) => (c, a.b.c).
 * @param {string} namespace Dot-separated sequence of a-z, A-Z, 0-9, _ and $.
 * @param {(name: string, fullname: string) => void | false} callback Return false to stop the travel.
 * @returns {void}
 */
const travelNamespaceFromRoot = (namespace, callback) => {
  if (typeof namespace !== 'string') { return; }
  const parts = namespace.split('.');
  for (let index = 0; index < parts.length; index++) {
    const name = parts[index];
    const fullname = parts.slice(0, index + 1).join('.');
    if (callback && callback(name, fullname) === false) {
      break;
    }
  }
}

/**
 * For namespace "a.b.c", the travel order is (c, a.b.c) => (b, a.b) => (a, a).
 * @param {string} namespace Dot-separated sequence of a-z, A-Z, 0-9, _ and $.
 * @param {(name: string, fullname: string) => void | false} callback Return false to stop the travel.
 * @returns {void}
 */
const travelNamespaceToRoot = (namespace, callback) => {
  if (typeof namespace !== 'string') { return; }
  const parts = namespace.split('.');
  for (let index = parts.length - 1; index >= 0; index--) {
    const name = parts[index];
    const fullname = parts.slice(0, index + 1).join('.');
    if (callback && callback(name, fullname) === false) {
      break;
    }
  }
}

module.exports = {
  travelNamespaceFromRoot,
  travelNamespaceToRoot
}
