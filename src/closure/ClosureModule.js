'use strict';

const pig = require('slim-pig');

const asString = require('../utils/asString');
const { VERSIONS } = require('../langs');
const ModuleState = require('./ModuleState');
const ModuleType = require('./ModuleType');
const PluginError = require('../errors/PluginError');
const resolveRequest = require('../utils/resolveRequest');

const InvalidNamespaceError = require('../errors/InvalidNamespaceError');
const NamespaceConflictError = require('../errors/NamespaceConflictError');
const NamespaceDuplicateError = require('../errors/NamespaceDuplicateError');

/** @typedef {import('../types').ClosureTree} ClosureTree */
/** @typedef {import('../types').DefineParam} DefineParam */
/** @typedef {import('../types').DependencyParam} DependencyParam */
/** @typedef {import('../types').Environment} Environment */
/** @typedef {import('../types').ExpressionNode} ExpressionNode */
/** @typedef {import('../types').NamespaceInfo} NamespaceInfo */
/** @typedef {import('../types').ProgramNode} ProgramNode */
/** @typedef {import('../types').ProvideInfo} ProvideInfo */
/** @typedef {import('../types').RequireInfo} RequireInfo */
/** @typedef {import('../types').StatementNode} StatementNode */
/** @typedef {import('../types').WPJavascriptParser} WPJavascriptParser */

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

class ClosureModule {
  /** 
   * @param {object} options
   * @param {string} options.request An absolute file.
   * @param {ClosureTree} options.tree
   * @param {Environment} options.env
   * @param {WPJavascriptParser} options.parser
   * @throws {Error} Throw Error if the request invalid.
   */
  constructor({ request, tree, env, parser }) {
    if (typeof request !== 'string') {
      throw new Error('Request must be string.');
    }
    if (pig.pattern.isGlob(request)) {
      throw new Error(`Request "${request}" must be non glob.`);
    }

    /** @type {ClosureTree} */
    this.tree = tree;
    /** @type {Environment} */
    this.env = env;

    /** @type {string} */
    this.request = resolveRequest(request, env.context);
    /** @type {string} */
    this.source = undefined;

    /** @type {WPJavascriptParser} */
    this.parser = parser;

    /** @type {ModuleState} */
    this.state = ModuleState.UNLOAD;

    /** 
     * True if this module is the base.js file.
     * @type {boolean} */
    this.isbase = false;
    /** 
     * True if this module is a dependencies file like the deps.js in Closure library.
     * @type {boolean}
     */
    this.isdeps = false;

    /** @type {ModuleType} */
    this.type = ModuleType.SCRIPT;
    /** 
     * The goog.module.declareLegacyNamespace statement.
     * @type {StatementNode} */
    this.legacy = undefined;
    /** @type {string} */
    this.lang = 'es3';
    /** @type {Map<string, ProvideInfo>} */
    this.provides = new Map();
    /** @type {Map<string, RequireInfo>} */
    this.requires = new Map();
    /** 
     * Record namespace usages in PROVIDE and legacy GOOG module.
     * @type {Map<string, ExpressionNode[]>} */
    this.namespaceUsages = new Map();
    /** 
     * Cache of namespace types.
     * @type {Map<string, NamespaceInfo>} */
    this.namespaceTypes = new Map();
    /** @type {Map<string, DefineParam>} */
    this.defines = new Map();

    /** 
     * Errors when parsing.
     * @type {Error[]} */
    this.errors = [];
    /** 
     * Warings when parsing.
     * @type {Error[]} */
    this.warnings = [];
  }

  /**
   * @param {string} namespace Dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   * @param {ProvideInfo} [info]
   * @returns {void}
   * @throws {InvalidNamespaceError} Throw if invalid namespace grammar;
   * @throws {NamespaceConflictError} Throw if namespace conflict with builtin object;
   * @see isBuiltin
   * @throws {NamespaceConflictError} Throw if namespace start with goog but not Closure library module;
   * @throws {NamespaceDuplicateError} Throw if namespace duplicate;
   */
  addProvide(namespace, info) {
    if (typeof namespace !== 'string') {
      return;
    }

    // Error if invalid namespace grammar.
    if (typeof namespace !== 'string' || !NAME_REG.test(namespace)) {
      const loc = (info && info.expr) ? info.expr.loc : undefined;
      throw new InvalidNamespaceError(
        this.request, loc,
        'its should be dot-separated sequence of a-z, A-Z, 0-9, _ and $'
      );
    }

    // Error if conflict with builtin object.
    const namespaceRoot = namespace.split('.')[0];
    if (isBuiltin(namespaceRoot)) {
      const loc = (info && info.expr) ? info.expr.loc : undefined;
      throw new NamespaceConflictError(
        this.request, loc,
        namespace, 'builtin or reserved keyword'
      );
    }

    // Error if start with goog but not Closure library module.
    if (namespace.split('.')[0] === 'goog') {
      if (!pig.fs.isSubDirectory(this.request, this.tree.libpath)) {
        const loc = (info && info.expr) ? info.expr.loc : undefined;
        throw new NamespaceConflictError(
          this.request, loc,
          namespace, 'Closure library namespace goog'
        );
      }
    }

    // Error if namespace duplicate.
    if (this.provides.has(namespace)) {
      const info = this.provides.get(namespace);
      const loc = (info && info.expr) ? info.expr.loc : undefined;
      throw new NamespaceDuplicateError(
        this.request, loc, namespace, true
      );
    }

    this.provides.set(namespace, info);
    this.namespaceTypes.clear();
    if (this.tree) {
      this.tree.addProvide(namespace, this);
    }
  }

  /**
   * @param {string} namespace Dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   * @param {RequireInfo} info
   * @returns {void}
   * @throws {NamespaceDuplicateError} Throw if namespace duplicate;
   */
  addRequire(namespace, info) {
    if (typeof namespace !== 'string') {
      return;
    }

    if (this.requires.has(namespace)) {
      if (info.confirmed === false) { return; }

      // Should not overwrite confirmed data.
      const oldInfo = this.requires.get(namespace);
      if (oldInfo.confirmed) {
        const loc = (oldInfo && oldInfo.expr) ? oldInfo.expr.loc : undefined;
        throw new NamespaceDuplicateError(
          this.request, loc, namespace, false
        );
      }

      this.requires.delete(namespace);
    }
    this.requires.set(namespace, info);
    this.namespaceTypes.clear();
  }

  /**
   * Get the namespace information.
   * !!This method just work after all goog.require/provide/module/declareLegacyNamespace statements has parsed.  
   * If this module provide namespace "a", type of namespace "b" is "unknow" and its owner is undefined;  
   * If this module provide namespace "a.b", type of namespace "a.b.c" is "provide" and its owner is "a.b";  
   * If this module require namespace "a.b", type of namespace "a.b.c" is "require" and its owner is "a.b";  
   * If this module provide/require namespace "a.b", type of namespace "a.c" is "implicit" and its owner is "a";   
   * @param {string} namespace Dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   * @returns {NamespaceInfo} Always return "unknow" outside PROVIDE and legacy GOOG module.
   */
  getNamespaceInfo(namespace) {
    // If has cached.
    if (this.namespaceTypes.has(namespace)) {
      return this.namespaceTypes.get(namespace);
    }

    /** @type {NamespaceInfo} */
    let type = undefined;

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
    if (type === undefined) {
      for (const provide of this.provides.keys()) {
        if (namespaceRoot === provide.split('.')[0]) {
          type = { type: 'implicit', owner: namespaceRoot };
          break;
        }
      }
    }
    // Search implicit namespaces of required.
    if (type === undefined) {
      for (const require of this.requires.keys()) {
        if (namespaceRoot === require.split('.')[0]) {
          type = { type: 'implicit', owner: namespaceRoot };
          break;
        }
      }
    }

    // If still not found, use default.
    if (type === undefined) { type = { type: 'unknow' }; }

    if (type.type !== 'unknow') {
      // If this not PROVIDE or legacy GOOG module, force type to "unknow".
      const isLegacyGOOGModule = this.type === ModuleType.GOOG && !!this.legacy;
      if (this.type !== ModuleType.PROVIDE && !isLegacyGOOGModule) {
        type.type = 'unknow';
      }
    }

    this.namespaceTypes.set(namespace, type);
    return type;
  }

  /**
   * Load from request, goog.addDependency params or source.
   * @arg {string | Buffer | DependencyParam} [arg]
   * @returns {void}
   */
  load(arg) {
    if (arg === undefined || typeof arg === 'string' || Buffer.isBuffer(arg)) {
      const source = asString(/** @type {any} */(arg));
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

        /** @type {any} */
        const state = {
          closure: {
            module: this
          }
        };
        this.parser.parse(this.source, state);
      } catch (err) {
        this.errors.push(err);
        this._unload();
      }

      if (this.errors.length === 0) {
        this.state = ModuleState.LOAD;
      }
    } else if (typeof arg === 'object') {
      if (this.state >= ModuleState.CACHE) return;
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
    }
  }

  /** @private */
  _unload() {
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
    this.defines.clear();
  }

  unload() {
    this._unload();
    this.source = undefined;
    this.errors.length = 0;
    this.warnings.length = 0;
  }
}

module.exports = ClosureModule;
