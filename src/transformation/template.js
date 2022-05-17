'use strict';

const path = require('path');

const ModuleType = require('../closure/ModuleType');

/** @typedef {import('../types').ClosureModule} ClosureModule */
/** @typedef {import('../types').RequireInfo} RequireInfo */

/**
 * Get module transform target, defaults to "esm".  
 * If not ES or CommonJS module, result depend on target option;  
 * @param {ClosureModule} module
 * @param {'esm' | 'commonjs'} [target] Defaults to "esm".
 * @returns {'esm' | 'commonjs'}
 */
const getTransTarget = (module, target) => {
  if (module.type === ModuleType.ES) {
    return 'esm';
  } else if (module.type === ModuleType.COMMONJS) {
    return 'commonjs';
  } else if (target === 'commonjs') {
    return 'commonjs';
  } else {
    return 'esm';
  }
}

/**
 * Convert the required module request to relative.
 * @param {string} originalModule Absolute request for the original module.
 * @param {string} requiredModule Absolute request for the required module.
 * @returns {string} Relative request for argument of transformed require statement.
 */
const getRelativeRequest = (originalModule, requiredModule) => {
  let request = path.relative(path.dirname(originalModule), requiredModule);
  // Add prepend for sub path, eg. a/b.js => ./a/b.js.
  if (request.charCodeAt(0) !== 46) { // start with ".".
    request = '.' + path.sep + request;
  }
  // Convert all windows separators to "/".
  request = request.split('\\').join('/');
  return request;
}

/**
 * Get the variable name for the goog.require expression.
 * @param {ClosureModule} originalModule
 * @param {ClosureModule} requiredModule
 * @param {string} namespace
 * @param {RequireInfo} info
 * @returns {string | null} Return null if not has.
 */
const getRequireVar = (originalModule, requiredModule, namespace, info) => {
  if (info && info.used
    // Require non PROVIDE module in non PROVIDE module.
    && originalModule.type !== ModuleType.PROVIDE
    && requiredModule.type !== ModuleType.PROVIDE
  ) {
    return `__${namespace}__`.replace(/\./g, '_');
  }

  return null;
}

/**
 * Get equivalent identifier name of the goog.require expression.
 * @param {ClosureModule} originalModule
 * @param {ClosureModule} requiredModule
 * @param {string} namespace
 * @param {RequireInfo} info
 * @returns {string | null} Return null if not has;  
 * Return "null" if the original module is PROVIDE module;  
 */
const getRequireIdentifier = (
  originalModule, requiredModule, namespace, info
) => {
  const requireVar = getRequireVar(
    originalModule, requiredModule, namespace, info
  );
  // Use the require variable if has.
  if (requireVar !== null) { return requireVar; }

  // If goog.require expression result not used.
  if (info === undefined || info.used !== true) { return null; }
  // goog.require always return null in PROVIDE module.
  if (originalModule.type === ModuleType.PROVIDE) { return 'null'; }
  // Require a PROVIDE module in non PROVIDE module, direct use the globally 
  // accessible object associated with the namespace.
  if (requiredModule.type === ModuleType.PROVIDE) {
    if (namespace.startsWith('goog')) {
      return namespace;
    } else {
      // Add goog.global prefix for non Closure library namespace.
      return `goog.global.${namespace}`;
    }
  }

  // Should not execute to here.
  return null;
}

/**
 * Get the transformed require statement.
 * @param {ClosureModule} originalModule
 * @param {ClosureModule} requiredModule
 * @param {string} [requireVar]
 * @param {'esm' | 'commonjs'} [target]
 * @returns {string}
 */
const getRequireStatement = (
  originalModule, requiredModule, requireVar, target
) => {
  target = getTransTarget(originalModule, target);

  // Convert request to relative print format.
  const relRequest = getRelativeRequest(originalModule.request, requiredModule.request);

  /** @type {string} */
  let statement = undefined;
  if (target === 'commonjs') {
    if (requireVar === undefined || requireVar === null) {
      statement = `require("${relRequest}");\n`;
    } else {
      statement = `var ${requireVar} = require("${relRequest}");\n`;
    }
  } else {
    if (requireVar === undefined || requireVar === null || requireVar === '') {
      statement = `import "${relRequest}";\n`;
    } else {
      if (requiredModule.type === ModuleType.ES) {
        statement = `import * as ${requireVar} from "${relRequest}";\n`;
      } else {
        statement = `import ${requireVar} from "${relRequest}";\n`;
      }
    }
  }
  return statement;
}

/**
 * Get the transformed export statement.
 * @param {ClosureModule} module
 * @param {string} exportVar
 * @param {'esm' | 'commonjs'} [target]
 */
const getExportStatement = (module, exportVar, target) => {
  target = getTransTarget(module, target);

  if (target === 'commonjs') {
    return `module.exports = ${exportVar};\n`;
  } else {
    return `export default ${exportVar};\n`;
  }
}

module.exports = {
  getTransTarget,
  getRelativeRequest,
  getRequireVar,
  getRequireIdentifier,
  getRequireStatement,
  getExportStatement
};
