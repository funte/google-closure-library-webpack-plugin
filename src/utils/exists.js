'use strict';

const _fs = require('fs-extra');

/**
 * @param {string} file
 * @param {any} [fs] User provided file system, defaults to fs-extra.
 * @returns {boolean}
 */
const existsSync = (file, fs = _fs) => {
  if (typeof fs.exists === 'function') {
    return fs.existsSync(file);
  } else if (typeof fs.statSync === 'function') {
    try {
      fs.statSync(file);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
    return true;
  } else if (typeof fs.lstatSync === 'function') {
    try {
      fs.lstatSync(file);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
    return true;
  }

  return false;
}

/**
 * @param {string} file
 * @param {any} [fs] User provided file system, defaults to fs-extra.
 * @returns {Promise<boolean>}
 */
const exists = async (file, fs = _fs) => {
  return new Promise((resolve, reject) => {
    try {
      resolve(existsSync(file, fs));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  exists,
  existsSync
};
