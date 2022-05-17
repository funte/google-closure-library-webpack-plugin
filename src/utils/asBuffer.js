'use strict';

/**
 * @param {string | Buffer} input the input
 * @returns {Buffer} the converted buffer
 */
const asBuffer = input => {
  if (!Buffer.isBuffer(input)) {
    return Buffer.from(input, "utf-8");
  }
  return input;
};

module.exports = asBuffer;
