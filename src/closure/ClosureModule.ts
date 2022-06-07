import pig from 'slim-pig';

import { asString } from '../utils/asString';
import { VERSIONS } from '../langs';
import { PluginError } from '../errors/PluginError';
import { resolveRequest } from '../utils/resolveRequest';
import { travelNamespaceToRoot } from '../utils/travelNamespace';

import { InvalidNamespaceError } from '../errors/InvalidNamespaceError';
import { NamespaceConflictError } from '../errors/NamespaceConflictError';
import { NamespaceDuplicateError } from '../errors/NamespaceDuplicateError';

import type { ClosureTree } from "./ClosureTree";
import type { Environment } from "../Environment";
import type {
  Expression as ExpressionNode,
  SourceLocation,
  Statement as StatementNode
} from 'estree';
import type { GoogTrans } from '../transformation/transform/GoogTrans';

export enum ModuleState {
  UNLOAD = 0,
  CACHE,
  LOAD
};

export enum ModuleType {
  /** A script file that contains goog.module. */
  GOOG = 0,
  /** ECMAScript module. */
  ES,
  /** CommonJS module. */
  COMMONJS,
  /** A script file that contains goog.provide. */
  PROVIDE,
  /** A script file that does not contains goog.provide or goog.module. */
  SCRIPT
};

/** Represent a single JSDoc annotation, with an optional argument, e.g. @provideGoog, @type {string}. */
export interface ClosureCommentAnnotation {
  name: string;
  value?: string;
  loc?: SourceLocation;
}

/** Used to store parsed goog.define parameters. */
export interface DefineParam {
  /** The goog.define expression. */
  expr: ExpressionNode;
  /** The name parameter. */
  name: string;
  /** The stringfied defaultValue parameter. */
  value: string;
  /** 
   * Is the left part missing, to compat the google-closure-library@<=20190301.0.0,
   * e.g. https://github.com/google/closure-library/blob/1488aa237/closure/goog/base.js#L213
   */
  missingLeft?: boolean;
}

/** Dependency param that used to store parsed goog.addDependency parameters. */
export interface DependencyParam {
  /** Source of the goog.addDependency statement. */
  text: string;
  /** The relative path from base.js to the js file. */
  relPath: string;
  /** An array of strings with the names of the objects this file provides. */
  provides: string[];
  /** An array of strings with the names of the objects this file requires. */
  requires: string[];
  /** Parameters indicate the Closure module type and language version. */
  flags: { module?: string, lang?: string };
}
export function instanceOfDependencyParam(object: any): object is DependencyParam {
  return typeof object === 'object' && !!object
    && 'text' in object && typeof object.text === 'string'
    && 'relPath' in object && typeof object.relPath === 'string'
    && 'provides' in object && Array.isArray(object.provides)
    && 'requires' in object && Array.isArray(object.requires)
    && 'flags' in object && typeof object.flags === 'object';
}

/** More information see {@link ClosureModule.getNamespaceType}. */
export interface NamespaceType {
  /** Always "unknow" outside PROVIDE and legacy GOOG module. */
  type: 'provide' | 'require' | 'implicit' | 'unknow';
  /** Its owner namespace. */
  owner?: string;
}

/** Closure module provide information. */
export interface ProvideInfo {
  /** This provided namespace. */
  fullname: string;
  /** The provide expression, e.g. goog.module/provide/declareModuleId/declareNamespace. */
  expr?: ExpressionNode;
  /** The provide statement. */
  statement?: StatementNode;
  /** The implicit namespaces need construct, only defined in PROVIDE and legacy GOOG module. */
  implicities?: string[];
  /** Exported local variable, defaults to exports, only defined in base.js and GOOG module. */
  id?: string;
  /** Declaration of the exported local variable, only defined in GOOG module. */
  declaration?: StatementNode;
}

/** Closure module require information. */
export interface RequireInfo {
  /** This required namespace. */
  fullname: string;
  /** True if get from goog.require expression. */
  confirmed: boolean;
  /** Insert position for transformed import statement. */
  position: number;
  /** The goog.require expression, undefined if not confirmed. */
  expr?: ExpressionNode;
  /** The goog.require statement. */
  statement?: StatementNode;
  /** True if the goog.require expression result is used. */
  used?: boolean;
}

const NAME_REG = /^([a-zA-Z_$]+)(.[a-zA-Z0-9_$]+)*$/;
const LIB_NAME_REG = /^(goog)(.[a-zA-Z0-9_$]+)*$/;

const isBuiltin = name => [
  // Web browser environment reserved.
  'window', 'document',
  // Worker reserved.
  'WorkerGlobalScope',
  // ES module import and export.
  'import', 'export',
  // NodeJS environment reserved(except the exports).
  'global', 'module', 'require',
  // Standard built-in objects and methods.
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects.
  'Infinity', 'NaN', 'undefined', 'globalThis',
  'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'encodeURI',
  'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'escape',
  'unescape', 'uneval',
  'Object', 'Function', 'Boolean', 'Symbol',
  'Error', 'AggregateError', 'EvalError', 'InternalError', 'RangeError',
  'ReferenceError', 'SyntaxError', 'TypeError', 'URIError',
  'Number', 'BigInt', 'Math', 'Date',
  'String', 'RegExp',
  'Buffer',
  'Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
  'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array',
  'Map', 'Set', 'WeakMap', 'WeakSet',
  'ArrayBuffer', 'SharedArrayBuffer', 'Atomics', 'DataView', 'JSON',
  'Promise', 'Generator', 'GeneratorFunction', 'AsyncFunction', 'AsyncGenerator',
  'AsyncGeneratorFunction',
  'Reflect', 'Proxy',
  'Intl',
  'WebAssembly',
  // Other keywords should reserved.
  'this', 'super', 'self', 'define', 'new', 'delete'
].includes(name);

export class ClosureModule {
  public tree: ClosureTree | undefined;
  public env: Environment;

  public request: string;
  public source?: string = undefined;

  public parser: any;

  public state: ModuleState = ModuleState.UNLOAD;

  /** True if this module is the base.js file. */
  public isbase: boolean = false;
  /** True if this module is a dependencies file like the deps.js in Closure library. */
  public isdeps: boolean = false;

  public type: ModuleType = ModuleType.SCRIPT;
  /** True if goog.module.declareLegacyNamespace missing. */
  public legacy: true | StatementNode | undefined;
  public lang: string = 'es3';
  public provides: Map<string, ProvideInfo | undefined> = new Map();
  public requires: Map<string, RequireInfo | undefined> = new Map();
  /** Record namespace usages in PROVIDE and legacy GOOG module. */
  public namespaceUsages: Map<string, ExpressionNode[]> = new Map();
  /** Cache of namespace types. */
  public namespaceTypes: Map<string, NamespaceType> = new Map();
  /** Parsed goog.define parameters in this module. */
  public defineParams: Map<string, DefineParam[]> = new Map();
  /** Some GoogTrans ready to apply. */
  public trans: GoogTrans[] = [];

  /** Errors when parsing. */
  public errors: PluginError[] = [];
  /** Warnings when parsing. */
  public warnings: PluginError[] = [];

  /** 
   * @param options.request - An absolute file.
   */
  constructor(options: {
    request: string,
    tree: ClosureTree,
    env: Environment,
    parser: any
  }) {
    const { request, tree, env, parser } = options;

    if (typeof request !== 'string') {
      throw new Error('Request must be string.');
    }
    if (pig.pattern.isGlob(request)) {
      throw new Error(`Request "${request}" must be non glob.`);
    }

    this.tree = tree;
    this.env = env;

    this.request = resolveRequest(request, env.context);

    this.parser = parser;
  }

  /**
   * @param namespace - Full namespce, dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   * @throws {@link InvalidNamespaceError} Throw if invalid namespace grammar;
   * @throws {@link NamespaceConflictError} Throw if namespace conflict with builtin object;
   * @throws {@link NamespaceConflictError} Throw if namespace start with goog but not Closure library module;
   * @throws {@link NamespaceDuplicateError} Throw if namespace duplicate;
   */
  addProvide(namespace: string, info?: ProvideInfo): void {
    if (typeof namespace !== 'string') { return; }

    // Error if invalid namespace grammar.
    if (typeof namespace !== 'string' || !NAME_REG.test(namespace)) {
      const loc: any = info?.expr?.loc;
      throw new InvalidNamespaceError({
        file: this.request, loc,
        desc: 'its should be dot-separated sequence of a-z, A-Z, 0-9, _ and $'
      });
    }

    // Error if conflict with builtin object.
    const namespaceRoot = namespace.split('.')[0];
    if (isBuiltin(namespaceRoot)) {
      const loc: any = info?.expr?.loc;
      throw new NamespaceConflictError({
        file: this.request, loc,
        namespace, what: 'builtin or reserved keyword'
      });
    }

    // Error if start with goog but not Closure library module.
    if (namespace.split('.')[0] === 'goog' && this.tree?.libpath) {
      if (!pig.fs.isSubDirectory(this.request, this.tree.libpath)) {
        const loc: any = info?.expr?.loc;
        throw new NamespaceConflictError({
          file: this.request, loc,
          namespace, what: 'Closure library namespace goog'
        });
      }
    }

    // Error if namespace duplicate.
    if (this.provides.has(namespace)) {
      const info = this.provides.get(namespace);
      const loc: any = info?.expr?.loc;
      throw new NamespaceDuplicateError({
        file: this.request, loc, namespace, isProvide: true
      });
    }

    this.provides.set(namespace, info);
    this.namespaceTypes.clear();
    if (this.tree) {
      this.tree.addProvide(namespace, this);
    }
  }

  /**
   * @param namespace - Full namespce, dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   * @throws {@link NamespaceDuplicateError} Throw if namespace duplicate;
   */
  addRequire(namespace: string, info?: RequireInfo): void {
    if (typeof namespace !== 'string') { return; }

    if (this.requires.has(namespace)) {
      const oldInfo = this.requires.get(namespace);
      // Process the duplication.
      if (oldInfo) {
        if (info && !info.confirmed) { return; }
        // Duplicate error if both confirmed.
        if (oldInfo.confirmed) {
          const loc: any = info?.expr?.loc;
          throw new NamespaceDuplicateError({
            file: this.request, loc, namespace, isProvide: false
          });
        }
      }
      // Delete the old uncomfirmed information.
      this.requires.delete(namespace);
    }
    this.requires.set(namespace, info);
    this.namespaceTypes.clear();
  }

  /**
   * Get the namespace type information.
   * !!This method just work after all goog.require/provide/module/declareLegacyNamespace statements has parsed.  
   * If this module provide namespace "a", type of namespace "b" is "unknow" and its owner is undefined;  
   * If this module provide namespace "a.b", type of namespace "a.b.c" is "provide" and its owner is "a.b";  
   * If this module require namespace "a.b", type of namespace "a.b.c" is "require" and its owner is "a.b";  
   * If this module provide/require namespace "a.b", type of namespace "a.c" is "implicit" and its owner is "a";   
   * @param namespace - Full namespace, dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   */
  getNamespaceType(namespace: string): NamespaceType {
    // If has cached.
    let type = this.namespaceTypes.get(namespace);
    if (type) { return type; }

    // Search requires and provides.
    const parts = namespace.split('.');
    while (parts.length > 0) {
      const current = parts.join('.');
      if (this.requires.has(current)) {
        type = { type: 'require', owner: current };
        break;
      } else if (this.provides.has(current)) {
        type = { type: 'provide', owner: current };
        break;
      }
      parts.pop();
    }

    const namespaceRoot = namespace.split('.')[0];
    // Search implicit namespaces of provided.
    if (!type) {
      for (const provide of this.provides.keys()) {
        if (namespaceRoot === provide.split('.')[0]) {
          type = { type: 'implicit', owner: namespaceRoot };
          break;
        }
      }
    }
    // Search implicit namespaces of required.
    if (!type) {
      for (const require of this.requires.keys()) {
        if (namespaceRoot === require.split('.')[0]) {
          type = { type: 'implicit', owner: namespaceRoot };
          break;
        }
      }
    }

    // If still not found, use default.
    if (!type) { type = { type: 'unknow' }; }

    if (type.type !== 'unknow') {
      // If this not PROVIDE or legacy GOOG module, force type to "unknow".
      if (this.type !== ModuleType.PROVIDE && !this.legacy) {
        type.type = 'unknow';
      }
    }

    this.namespaceTypes.set(namespace, type);
    return type;
  }

  /** Load from request, goog.addDependency params or source. */
  load(
    arg: string | Buffer | DependencyParam | null | undefined
  ): void {
    if (instanceOfDependencyParam(arg)) {
      if (this.state >= ModuleState.CACHE) { return; }
      this._unload();

      try {
        arg.provides.forEach(name => { this.addProvide(name, undefined); });
        arg.requires.forEach(name => { this.addRequire(name, undefined); });

        const moduleFlag = arg.flags.module;
        if (typeof moduleFlag === 'string') {
          if (moduleFlag === 'goog') {
            this.type = ModuleType.GOOG;
          } else if (moduleFlag === 'es6') {
            this.type = ModuleType.ES;
          } else {
            throw new PluginError(`Unknow module flag ${moduleFlag} in the goog.adDependency params of ${this.request}.`);
          }
        }

        const langFlag = arg.flags.lang;
        if (typeof langFlag === 'string') {
          if (VERSIONS.includes(langFlag)) {
            this.lang = langFlag;
          } else {
            throw new PluginError(`Unknow language version in the goog.addDependency params of ${this.request}.`);
          }
        }
      } catch (err) {
        this.errors.push(err);
        this._unload();
      }

      if (this.errors.length === 0) {
        this.state = ModuleState.CACHE;
      }
    } else {
      const source: string | undefined =
        typeof arg === 'string' || Buffer.isBuffer(arg)
          ? asString(arg)
          : undefined;
      // If load from different source, need parse again.
      if (typeof source === 'string' && this.source !== source) {
        this.source = source;
      } else if (this.state > ModuleState.LOAD) {
        return;
      }
      this._unload();

      try {
        if (typeof this.source !== 'string') {
          // To compat the old enhanced-resolve CachedInputFileSystem ISSUE.
          // See https://github.com/webpack/enhanced-resolve/issues/89.
          try {
            this.source = asString(this.env.fs.readFileSync(this.request, 'utf-8'));
          } catch (err) {
            this.source = asString(this.env.fs.readFileSync(this.request));
          }
        }

        this.parser.parse(this.source, { closure: { module: this } } as any);
      } catch (err) {
        this.errors.push(err);
        this._unload();
      }

      if (this.errors.length === 0) {
        this.state = ModuleState.LOAD;
      }
    }
  }

  /** Parse and fill the implicit namespaces of all provide informations, its auto execute while parsing. */
  parseImplicities(): void {
    if (this.type === ModuleType.PROVIDE || this.legacy) {
      // Store all implicit and provided namespaces.
      const all: Set<string> = new Set();

      Array.from(this.provides.values())
        // Sort provided namespaces by end position.
        .sort((a, b) => {
          // Error if this provide information undefined, this should not 
          // happen, just in case.
          if (!a || !b) {
            throw new PluginError(`Undefined provide information at file ${this.request}.`);
          }
          // Error if expression range property undefined.
          if (!a.expr?.range || typeof a.expr?.range[1] !== 'number'
            || !b.expr?.range || typeof b.expr?.range[1] !== 'number'
          ) {
            throw new PluginError(`Undefined expression range property at file ${this.request}.`);
          }

          const apos = a.expr ? a.expr.range[1] : 0;
          const bpos = b.expr ? b.expr.range[1] : 0;
          return apos - bpos;
        })
        // Fill the implicit namespaces.
        .forEach(info => {
          // Error if this provide information undefined, this should not 
          // happen, just in case.
          if (!info) {
            throw new PluginError(`Undefined provide information at file ${this.request}.`);
          }

          if (info.implicities) {
            info.implicities.length = 0;
          } else {
            info.implicities = [];
          }
          travelNamespaceToRoot(info.fullname, (name, fullname) => {
            if (fullname === 'goog') { return; }
            // If current implicit namespace not contruct.
            if (!all.has(fullname) && fullname !== info.fullname) {
              // @ts-ignore
              info.implicities.push(fullname);
            }
            all.add(fullname);
          });
          info.implicities = info.implicities.reverse();
        });
    }
  }

  private _unload(): void {
    // Remove provides.
    for (const [namespace,] of this.provides.entries()) {
      if (this.tree) {
        this.tree.namespaceToRequest.delete(namespace);
      }
    }

    this.state = ModuleState.UNLOAD;

    this.isbase = false;
    this.isdeps = false;

    this.type = ModuleType.SCRIPT;
    this.legacy = undefined;
    this.lang = 'es3';
    this.provides.clear();
    this.requires.clear();
    this.namespaceUsages.clear();
    this.namespaceTypes.clear();
    this.defineParams.clear();
    this.trans.length = 0;
  }

  unload(): void {
    this._unload();
    this.source = undefined;
    this.errors.length = 0;
    this.warnings.length = 0;
  }
}
