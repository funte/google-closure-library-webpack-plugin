import _fs from 'fs-extra';

import type { DefineValueType, TargetOption, WarningLevelOption } from './Plugin';

export class Environment {
  public readonly context: string;
  public readonly fs: any;
  public readonly target: TargetOption;
  public readonly globalObject: string | undefined;
  /** All names and values that parsed from {@link PluginOptions.defs}. */
  public readonly defines: Map<string, string> = new Map();
  /** Constant names and values. */
  public readonly constants: Map<string, DefineValueType> = new Map();
  public readonly warningLevel: WarningLevelOption;
  public readonly logTransformed: boolean;

  /**
   * @param options.context - An absolute directory used to resolve the relative pattern to absolute.
   * @param options.fs - User provided file system, defaults to fs-extra.
   * @param options.target - Closure module transform target, "esm" or "commonjs", defaults to "esm".
   * @param options.defines - List of string and value to override the goog.define expression, if the name part is omitted, its value will be true.  
   * The value could be string, boolean and number.  
   * @param warningLevel - "show" show all warnings, "hidelib" hide warnings in Closure library modules and show warnings in user modules, "hideUser" opposite "hideLib", "hide" hide all warnings, defualts to "hideLib".
   * @param options.logTransformed - Enable log transformed Closure module to build directory, defaults to false.
   */
  constructor(options: {
    context: string,
    fs?: any,
    target?: TargetOption,
    globalObject?: string,
    defines?: any[],
    warningLevel?: WarningLevelOption,
    logTransformed?: boolean
  }) {
    let { context, fs, target, globalObject, defines, warningLevel, logTransformed } = options;

    this.context = context;
    this.fs = fs || _fs;
    this.target = 'esm';
    if (typeof target === 'string') {
      target = target.toLowerCase() as any;
      this.target = target === 'commonjs' ? target : 'esm';
    }
    this.globalObject = globalObject;

    this.defines.set('goog.DEBUG', 'false'); // goog.DEBUG defaults to false.
    if (defines && Array.isArray(defines)) {
      for (const define of defines) {
        let name: string | undefined = undefined;
        let value: string | undefined = undefined;
        if (typeof define === 'string') {
          // If the value part is omitted, its value will be true.
          name = define;
          value = 'true';
        } else if (Array.isArray(define) && define.length > 0) {
          if (typeof define[0] === 'string') {
            name = define[0];
            if (define.length === 1) {
              // If the value part is omitted, its value will be true.
              value = 'true';
            } else if (define.length === 2) {
              if (['string', 'boolean', 'number'].includes(typeof define[1])) {
                value = JSON.stringify(define[1]);
              }
            }
          }
        }
        if (name !== undefined && value !== undefined) {
          this.defines.set(name, value);
        }
      }
    }

    // Set constant name and value.
    this.constants.set('COMPILED', true);

    if (['show', 'hideLib', 'hideUser', 'hide'].includes(warningLevel as any)) {
      // @ts-ignore
      this.warningLevel = warningLevel;
    } else {
      this.warningLevel = 'hideLib';
    }

    this.logTransformed = !!logTransformed;
  }
}
