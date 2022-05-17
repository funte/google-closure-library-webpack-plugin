'use strict';

/**
 * @param {any} options
 * @param {any} hookOrMap
 * @param {any | any[]} [keys]
 * @param {function} [callback]
 * @returns {void}
 */
const tap = (options, hookOrMap, keys, callback) => {
  keys = [].concat(keys || []);

  let waitToTap = new Set();
  if (keys.length === 0) {
    waitToTap.add(hookOrMap);
  } else {
    for (const key of keys) {
      if (key === undefined || key === null) { continue; }
      waitToTap.add(hookOrMap.for(key));
    }
  }
  for (const hook of waitToTap) {
    hook.tap(options, callback);
  }
}

/**
 * @param {any} options
 * @param {any[]} hookOrMaps
 * @param {any | any[]} [keys]
 * @param {function} [callback]
 * @returns {void}
 */
const tapMulti = (options, hookOrMaps, keys, callback) => {
  hookOrMaps = [].concat(hookOrMaps || []);
  keys = [].concat(keys || []);

  let waitToTap = new Set();
  if (keys.length === 0) {
    waitToTap = new Set(keys);
  } else {
    for (const hookOrMap of hookOrMaps) {
      for (const key of keys) {
        if (key === undefined || key === null) { continue; }
        waitToTap.add(hookOrMap.for(key));
      }
    }
  }
  for (const hook of waitToTap) {
    hook.tap(options, callback);
  }
}

module.exports = {
  tap,
  tapMulti
};
