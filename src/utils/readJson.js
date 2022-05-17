'use strict';

const _fs = require('fs-extra');

/**
 * @param {string} file
 * @param {any} [fs] User provided file system, defaults to fs-extra.
 * @returns {JSON}
 */
const readJsonSync = (file, fs = _fs) => {
  if (typeof fs.readJsonSync === 'function') {
    return fs.readJsonSync(file);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * @param {string} file
 * @param {any} [fs] User provided file system, defaults to fs-extra.
 * @returns {Promise<JSON>}
 */
const readJson = async (file, fs = _fs) => {
  return new Promise((resolve, reject) => {
    try {
      resolve(readJsonSync(file, fs));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  readJson,
  readJsonSync
};
