'use strict';

const path = require('path');
const { OriginalSource, SourceMapSource } = require('webpack-sources');

const asString = require('../utils/asString');

/** @typedef {import('../types').WPSource} WPSource */

const WINDOWS_ABS_PATH_REGEXP = /^[a-zA-Z]:[\\/]/;
const WINDOWS_PATH_SEPARATOR_REGEXP = /\\/g;

/**
 * @see https://github.com/webpack/webpack/blob/0522deb76/lib/util/identifier.js#L23
 * @param {string} context context for relative path
 * @param {string} maybeAbsolutePath path to make relative
 * @returns {string} relative path in request style
 */
const absoluteToRequest = (context, maybeAbsolutePath) => {
  if (maybeAbsolutePath[0] === "/") {
    if (
      maybeAbsolutePath.length > 1 &&
      maybeAbsolutePath[maybeAbsolutePath.length - 1] === "/"
    ) {
      // this 'path' is actually a regexp generated by dynamic requires.
      // Don't treat it as an absolute path.
      return maybeAbsolutePath;
    }

    const querySplitPos = maybeAbsolutePath.indexOf("?");
    let resource =
      querySplitPos === -1
        ? maybeAbsolutePath
        : maybeAbsolutePath.slice(0, querySplitPos);
    resource = path.posix.relative(context, resource);
    if (!resource.startsWith("../")) {
      resource = "./" + resource;
    }
    return querySplitPos === -1
      ? resource
      : resource + maybeAbsolutePath.slice(querySplitPos);
  }

  if (WINDOWS_ABS_PATH_REGEXP.test(maybeAbsolutePath)) {
    const querySplitPos = maybeAbsolutePath.indexOf("?");
    let resource =
      querySplitPos === -1
        ? maybeAbsolutePath
        : maybeAbsolutePath.slice(0, querySplitPos);
    resource = path.win32.relative(context, resource);
    if (!WINDOWS_ABS_PATH_REGEXP.test(resource)) {
      resource = resource.replace(WINDOWS_PATH_SEPARATOR_REGEXP, "/");
      if (!resource.startsWith("../")) {
        resource = "./" + resource;
      }
    }
    return querySplitPos === -1
      ? resource
      : resource + maybeAbsolutePath.slice(querySplitPos);
  }

  // not an absolute path
  return maybeAbsolutePath;
};

/**
 * @see https://github.com/webpack/webpack/blob/0522deb76/lib/util/identifier.js#L222
 * @param {string} context absolute context path
 * @param {string} request any request string may containing absolute paths, query string, etc.
 * @returns {string} a new request string avoiding absolute paths when possible
 */
const contextify = (context, request) => {
  return request
    .split("!")
    .map(r => absoluteToRequest(context, request))
    .join("!");
};

/**
 * @see https://github.com/webpack/webpack/blob/0522deb76/lib/NormalModule.js#L87
 * @param {string} context absolute context path
 * @param {string} source a source path
 * @returns {string} new source path
 */
const contextifySourceUrl = (context, source) => {
  if (source.startsWith("webpack://")) return source;
  return `webpack://${contextify(context, source)}`;
};

/**
 * @see https://github.com/webpack/webpack/blob/0522deb76/lib/NormalModule.js#L98
 * @param {string} context absolute context path
 * @param {object} sourceMap a source map
 * @returns {object} new source map
 */
const contextifySourceMap = (context, sourceMap) => {
  if (!Array.isArray(sourceMap.sources)) return sourceMap;
  const { sourceRoot } = sourceMap;
  /** @type {function(string): string} */
  const mapper = !sourceRoot
    ? source => source
    : sourceRoot.endsWith("/")
      ? source =>
        source.startsWith("/")
          ? `${sourceRoot.slice(0, -1)}${source}`
          : `${sourceRoot}${source}`
      : source =>
        source.startsWith("/")
          ? `${sourceRoot}${source}`
          : `${sourceRoot}/${source}`;
  const newSources = sourceMap.sources.map(source =>
    contextifySourceUrl(context, mapper(source))
  );
  return {
    ...sourceMap,
    file: "x",
    sourceRoot: undefined,
    sources: newSources
  };
};

/**
 * @param {string} context
 * @param {string} request
 * @param {string | Buffer} content
 * @param {object} [map]
 * @returns {WPSource}
 */
const createSource = (context, request, content, map) => {
  if (map) {
    return new SourceMapSource(
      asString(content),
      contextifySourceUrl(context, request),
      contextifySourceMap(context, map)
    );
  } else {
    return new OriginalSource(
      content,
      contextifySourceUrl(context, request)
    );
  }
}

module.exports = createSource;
