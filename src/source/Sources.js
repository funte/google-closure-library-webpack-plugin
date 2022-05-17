'use strict';

const _fs = require('fs-extra');
const minimatch = require('minimatch');
const pig = require('slim-pig');

const resolveRequest = require('../utils/resolveRequest');

/** @typedef {import('../types').ScanResult} ScanResult */

/**
 * @typedef {object} SourceCache
 * @property {string[]} patterns Non glob patterns.
 * @property {string[]} globs Glob patterns.
 */

/**
 * @param {string} pattern
 * @param {SourceCache} cache
 * @returns {boolean}
 */
const isMatchAny = function (pattern, cache) {
  // Match glob patterns in cache.
  for (const rule of cache.globs) {
    if (minimatch.match([pattern], rule).length !== 0) {
      return true;
    }
  }

  // Glob pattern only match glob patterns in cache.
  // If glob pattern not match any yet, return false.
  if (pig.pattern.isGlob(pattern)) {
    return false;
  }

  // Match non glob patterns in cache.
  for (const rule of cache.patterns) {
    if (pig.fs.isSameDirectory(pattern, rule)) { return true; }
    if (pig.fs.isSubDirectory(pattern, rule)) { return true; }
  }
  return false;
}

/**
 * @enum {number}
 */
const MatchState = {
  INCLUDE: 0,
  EXCLUDE: 1,
  UNKNOW: 2
};

// TODO: refator Sources.
class Sources {
  /**
   * @param {string | string[]} patterns List of files, directories or glob patterns.
   * @param {string} context Used to resolve relative pattern.
   * @param {any} [fs] User provided file system, defaults to fs-extra.
   */
  constructor(patterns, context, fs = _fs) {
    if (typeof context !== 'string') {
      throw new Error('Context must be string.');
    }
    if (pig.pattern.isGlob(context)) {
      throw new Error('Context must be non glob.');
    }
    if (!pig.pattern.isAbsolute(context)) {
      throw new Error('Context must be an absolute directory.');
    }
    /** @type {string} */
    this.context = context;
    this.fs = fs;

    /** 
     * Include patterns cache, must be absolute and non negative.
     * @type {SourceCache}
     */
    this.includes = {
      patterns: [],
      globs: []
    };
    /** 
     * Exclude patterns cache, must be absolute and non negative.
     * The negative patterns also live here.
     * @type {SourceCache}
     */
    this.excludes = {
      patterns: [],
      globs: []
    };

    /** 
     * Files found and their timestamp.
     * @type {Map<string, number>}
     */
    this.files = new Map();

    // Add to cache.
    this.add(patterns || []);
  }

  /**
   * @private
   * @param {string | string[]} patterns
   * @returns {string[]}
   */
  _absolute(patterns) {
    return patterns = []
      .concat(patterns || [])
      .filter(pattern => typeof pattern === 'string')
      .map(pattern => resolveRequest(pattern, this.context));
  }

  /**
   * @param {string | string[]} patterns
   * @returns {void}
   */
  add(patterns) {
    patterns = this._absolute(patterns);
    for (let pattern of patterns) {
      let negative = false;
      if (pattern[0] === '!') {
        negative = true;
        // Remove leading "!".
        pattern = pattern.slice(1);
      }

      // Match exclude cache, if match any, it's excluded, skip it.
      if (isMatchAny(pattern, this.excludes)) continue;
      // Match include cache, if match any and not negative, it's duplicate, sip it.
      if (isMatchAny(pattern, this.includes) && !negative) continue;

      const cache = negative ? this.excludes : this.includes;
      if (pig.pattern.isGlob(pattern)) {
        cache.globs.push(pattern);
      } else {
        cache.patterns.push(pattern);
      }
    }
  }

  clear() {
    this.files.clear();
  }

  /**
   * @param {string} pattern A file, directory or glob pattern that absolute or 
   * relative from the context.
   * @returns {MatchState}
   */
  match(pattern) {
    if (typeof pattern !== 'string') {
      throw new Error('Pattern must be string.');
    }
    pattern = resolveRequest(pattern, this.context)

    // Match exclude patterns, if match any, it's excluded.
    // Note: Must be ahead of testing this.includes.
    if (isMatchAny(pattern, this.excludes)) return MatchState.EXCLUDE;
    // Match include patterns, if match any, it's included.
    if (isMatchAny(pattern, this.includes)) return MatchState.INCLUDE;
    // Else all are unknow.
    return MatchState.UNKNOW;
  }

  /**
   * @param {string | string[]} [patterns] List of patterns, if undefined, 
   * defaults scan all.
   * @returns {ScanResult}
   * @throws {Error}
   */
  scan(patterns) {
    patterns = this._absolute(patterns);

    const added = [];
    const modified = [];
    const missing = [];

    patterns = [].concat(patterns || []);
    if (patterns.length !== 0) {
      patterns = patterns.filter(
        pattern => this.match(pattern) === MatchState.INCLUDE
      );
    } else {
      // If patterns undefined, scan whole include cache.
      patterns = this.includes.patterns.concat(this.includes.globs);
    }

    for (const pattern of patterns) {
      try {
        pig.fs.walkSync(
          pattern,
          file => {
            if (!isMatchAny(file, this.excludes)) {
              const mtime = this.fs.statSync(file).mtime.valueOf();
              if (this.files.has(file)) {
                // If file modified.
                if (mtime > this.files.get(file)) {
                  modified.push(file);
                }
              } else {
                // If file new added.
                added.push(file);
              }
              this.files.set(file, mtime);
            }
          },
          directory => {
            // If directory excluded, skip it.
            if (isMatchAny(directory, this.excludes)) {
              return 'skip';
            }
          },
          { fs: this.fs }
        );
      } catch (err) {
        if (err.code === 'ENOENT') {
          missing.push(pattern);
        } else {
          throw err;
        }
      }
    }

    return {
      files: Array.from(this.files.keys()),
      added,
      modified,
      removed: [],
      missing
    };
  }
}

module.exports = {
  Sources,
  MatchState
};
