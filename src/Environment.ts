import _fs from 'fs-extra';

import { findNodeModules } from './utils/findNodeModules';

import type { TargetOption } from './Plugin';

export class Environment {
  public readonly context: string;
  public readonly fs: any;
  public readonly NODE_MODULES: string | null | undefined;
  public readonly target: TargetOption;
  public readonly globalObject: string | null | undefined;
  public readonly defs: Map<string, string>;
  public readonly logTransformed: boolean;

  /**
   * @param options.context - An absolute directory used to resolve the relative pattern to absolute.
   * @param options.fs - User provided file system, defaults to fs-extra.
   * @param options.target - Closure module transform target, "esm" or "commonjs", defaults to "esm".
   * @param options.defs - List of string and value to override the goog.define expression, if the name part is omitted, its value will be true.
   * @param options.logTransformed - Enable log transformed Closure module to build directory, defaults to false.
   */
  constructor(options: {
    context: string,
    fs?: any,
    target?: TargetOption,
    globalObject?: string,
    defs?: any[],
    logTransformed?: boolean
  }) {
    let { context, fs, target, globalObject, defs, logTransformed } = options;

    this.context = context;
    this.fs = fs || _fs;
    this.NODE_MODULES = findNodeModules(__dirname, this.fs);
    this.target = 'esm';
    if (typeof target === 'string') {
      target = target.toLowerCase() as any;
      this.target = target === 'commonjs' ? target : 'esm';
    }
    this.globalObject = globalObject;

    this.defs = new Map();
    if (defs && Array.isArray(defs)) {
      for (const def of defs) {
        let name: any = undefined, value: any = undefined;
        if (typeof def === 'string') {
          name = def;
          value = 'true';
        } else if (Array.isArray(def) && def.length > 0) {
          if (typeof def[0] === 'string') {
            name = def[0];
            if (def.length === 1) {
              value = 'true';
            } else if (def.length === 2) {
              if (typeof def[1] === 'string') {
                value = `"${def[1]}"`;
              } else if (['boolean', 'number', 'function'].indexOf(typeof def[1])
                || def[1] instanceof RegExp
              ) {
                value = def[1].toString();
              }
            }
          }
        }
        if (typeof name === 'string') {
          this.defs.set(name, value);
        }
      }
    }

    this.logTransformed = !!logTransformed;
  }
}
