'ues stsrict';

const path = require('path');

const asString = require('../src/utils/asString');

/**
 * @param {any} fs
 * @param {string} file
 * @param {string | Buffer} content
 * @returns {void}
 */
const helper_writeFile = (fs, file, content) => {
  fs.mkdirpSync(path.dirname(file));
  fs.writeFileSync(file, asString(content));
}
/**
 * @param {any} fs
 * @param {string} file
 * @returns {void}
 */
const helper_removeFile = (fs, file) => {
  fs.unlinkSync(file);
}
/**
 * @param {any} fs
 * @param {string} file
 * @returns {void}
 */
const helper_touchFile = (fs, file) => {
  const time = Date.now();
  fs.utimesSync(file, time, time);
}

module.exports = {
  helper_writeFile,
  helper_removeFile,
  helper_touchFile
};
