import path from 'path';

import { ModuleType } from '../closure/ClosureModule';

import type { ClosureModule, RequireInfo } from '../closure/ClosureModule';
import type { TargetOption } from '../Plugin';

/**
 * Get module transform target, defaults to "esm".  
 * If not ES or CommonJS module, result depend on target option;  
 * @param target - Defaults to "esm".
 */
export function getTransTarget(
  module: ClosureModule,
  target?: TargetOption
): TargetOption {
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
 * @param originalModule - Absolute request for the original module.
 * @param requiredModule - Absolute request for the required module.
 * @returns Relative request for argument of transformed require statement.
 */
export function getRelativeRequest(
  originalModule: string,
  requiredModule: string
): string {
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
 * Get the require local variable name for the goog.require expression.
 * @returns Return null if not has.
 */
export function getRequiredVar(
  originalModule: ClosureModule,
  requiredModule: ClosureModule,
  namespace: string,
  info: RequireInfo
): string | null {
  if (info?.used
    // Require non PROVIDE module outside PROVIDE module.
    && originalModule.type !== ModuleType.PROVIDE
    && requiredModule.type !== ModuleType.PROVIDE
  ) {
    return `__${namespace}__`.replace(/\./g, '_');
  }

  return null;
}

/**
 * Get equivalent identifier name to replace the used goog.require expression.
 * @returns Return null if not has;  
 * Return "null" if the original module is PROVIDE module;  
 */
export function getRequireIdentifier(
  originalModule: ClosureModule,
  requiredModule: ClosureModule,
  namespace: string,
  info: RequireInfo
): string | null {
  // If goog.require expression result not used.
  if (!info?.used) { return null; }

  // goog.require always return null in PROVIDE module.
  if (originalModule.type === ModuleType.PROVIDE) {
    return 'null';
  }
  // goog.require outside PROVIDE module.
  else {
    // Require a PROVIDE module outside PROVIDE module, direct use the globally 
    // accessible object.
    if (requiredModule.type === ModuleType.PROVIDE) {
      if (namespace.startsWith('goog')) {
        return namespace;
      } else {
        // Add goog.global prefix for non Closure library namespace.
        return `goog.global.${namespace}`;
      }
    }
    // Require non PROVIDE module outside PROVIDE module, use the require local 
    // variable.
    else {
      return `__${namespace}__`.replace(/\./g, '_');
    }
  }
}

/** Get the transformed require statement. */
export function getRequireStatement(
  originalModule: ClosureModule,
  requiredModule: ClosureModule,
  requireVar?: string | null | undefined,
  target?: TargetOption
): string {
  // Convert request to relative print format.
  const relRequest = getRelativeRequest(originalModule.request, requiredModule.request);

  if (getTransTarget(originalModule, target) === 'commonjs') {
    if (!requireVar) {
      return `require("${relRequest}");\n`;
    } else {
      return `var ${requireVar} = require("${relRequest}");\n`;
    }
  } else {
    if (!requireVar) {
      return `import "${relRequest}";\n`;
    } else {
      if (requiredModule.type === ModuleType.ES) {
        return `import * as ${requireVar} from "${relRequest}";\n`;
      } else {
        return `import ${requireVar} from "${relRequest}";\n`;
      }
    }
  }
}

/** Get the transformed export statement. */
export function getExportStatement(
  module: ClosureModule,
  exportVar: string,
  target?: TargetOption
): string {
  if (getTransTarget(module, target) === 'commonjs') {
    return `module.exports = ${exportVar};\n`;
  } else {
    return `export default ${exportVar};\n`;
  }
}
