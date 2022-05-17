'use strict';

/**
 * @param {string | Buffer} input the input
 * @returns {string} the converted string
 */
const asString = input => {
  if (Buffer.isBuffer(input)) {
    return input.toString("utf-8");
  }
  return input;
};

module.exports = asString;
