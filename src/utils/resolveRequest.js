'use strict';

const pig = require('slim-pig');

/**
 * @param {string} pattern
 * @param {string} [context]
 * @returns {string}
 */
const resolveRequest = (pattern, context) => {
  pattern = pig.pattern.resolvePattern(pattern, context);

  // Convert windows driver letter to lowercase.
  if (pig.pattern.isWin32Pattern(pattern)) {
    let negative = false;
    if (pattern.charCodeAt(0) === 33) {
      negative = true;
      pattern = pattern.slice(1);
    }

    // If start with uppercase driver letter, convert to lowercase.
    const driverLetter = pattern.charCodeAt(0);
    if (driverLetter >= 65 && driverLetter <= 90) {
      pattern = pattern.charAt(0).toLowerCase() + pattern.slice(1);
    }

    if (negative) {
      pattern = '!' + pattern;
    }
  }

  return pattern;
}

module.exports = resolveRequest;
