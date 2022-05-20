'use strict';

const path = require('path');
const pig = require('slim-pig');

const ClosureModuleFactory = require('./ClosureModuleFactory');
const ModuleState = require('./ModuleState');
const ModuleType = require('./ModuleType');
const resolveRequest = require('../utils/resolveRequest');
const { MatchState, Sources } = require('../source/Sources');
const { travelNamespaceFromRoot } = require('../utils/travelNamespace');

const NamespaceDuplicateError = require('../errors/NamespaceDuplicateError');

/** @typedef {import('../types').ClosureModule} ClosureModule */
/** @typedef {import('../types').Environment} Environment */
/** @typedef {import('../types').ExpressionNode} ExpressionNode */
/** @typedef {import('../types').DependencyParam} DependencyParam */
/** @typedef {import('../types').Namespace} Namespace */
/** @typedef {import('../types').ScanResult} ScanResult */

class ClosureTree {
  /**
   * @param {object} options
   * @param {string} [options.base] Path to Closure library base.js file, must be absolute or relative from the environment context.
   * @param {string | string[]} options.sources List of absolute patterns, or relative from the environment context.
   * @param {Environment} options.env 
   */
  constructor({ base, sources, env }) {
    /** @type {ClosureModuleFactory} */
    this.factory = new ClosureModuleFactory();

    /** @type {Environment} */
    this.env = env;

    /** @type {string} */
    this.libpath = undefined;
    /** @type {string} */
    this.googpath = undefined;
    /** @type {string} */
    this.basefile = undefined;
    /** @type {string} */
    this.depsfile = undefined;

    /** @type {Map<string, string>} */
    this.namespaceToRequest = new Map();
    /** @type {Map<string, ClosureModule>} */
    this.requestToModule = new Map();
    /** @type {Namespace} */
    this.roots = {
      name: undefined,
      fullname: undefined,
      subs: new Map() // store all roots.
    };

    /** @type {Sources} */
    this.sources = new Sources(sources, env.context, env.fs);

    if (typeof base === 'string') {
      this.basefile = resolveRequest(base, env.context);
    } else if (typeof env.NODE_MODULES === 'string') {
      this.basefile = resolveRequest(
        'google-closure-library/closure/goog/base.js',
        env.NODE_MODULES);
    } else {
      this.warnings.push(
        new Error('Could not find Closure library base.js file.')
      );
    }
    if (typeof this.basefile === 'string') {
      this.googpath = path.dirname(this.basefile);
      this.libpath = resolveRequest('../../', this.googpath);
      this.depsfile = this.googpath + path.sep + 'deps.js';
    }
    // Add Closure library deps.js to sources.
    // Cache library modules from deps file more quick than scanning the whole directory.
    if (typeof this.depsfile === 'string') {
      this.sources.add(this.depsfile);
    }

    /** 
     * Errors when parsing Closure module.
     * @type {Error[]} */
    this.errors = [];
    /**
     * Warnings when parsing Closure module.
     * @type {Error[]} */
    this.warnings = [];

    this.scan();
  }

  /**
   * @private
   * @param {{errors: Error[], warnings: Error[]}} obj
   * @returns {void} 
   */
  _collectErrors(obj) {
    if (obj) {
      if (Array.isArray(obj.errors)) {
        this.errors.push(...obj.errors);
        obj.errors.length = 0;
      }
      if (Array.isArray(obj.warnings)) {
        this.warnings.push(...obj.warnings);
        obj.warnings.length = 0;
      }
    }
  }

  /**
   * @param {ClosureModule} module
   * @returns {void}
   */
  addModule(module) {
    if (this.requestToModule.has(module.request)) {
      return;
    }

    this._collectErrors(module);

    this.requestToModule.set(module.request, module);
    for (const [name,] of module.provides.entries()) {
      this.addProvide(name, module);
    }
  }

  /**
   * @param {string} namespace
   * @param {ClosureModule} module
   * @returns  {void}
   */
  addProvide(namespace, module) {
    const provider = this._get(namespace);
    if (provider && provider !== module) {
      const info = provider.provides.get(namespace);
      const loc = (info && info.expr) ? info.expr.loc : undefined;
      const error = new NamespaceDuplicateError(
        provider.request, loc,
        namespace, true
      );
      this.errors.push(error);
      return;
    }

    this.namespaceToRequest.set(namespace, module.request);

    // Construct the namespace.
    this.getNamespace(namespace, true);
  }

  clear() {
    this.namespaceToRequest.clear();
    this.requestToModule.clear();
    this.roots.subs.clear();
    this.sources.clear();
    this.errors.length = 0;
    this.warnings.length = 0;
  }

  /**
   * Unload and destory the module from tree, also remove its provides. 
   * @param {string} arg Request or namespace.
   * @returns {void}
   */
  deleteModule(arg) {
    if (typeof arg !== 'string') { return; }
    const module = this._get(arg);
    if (module === null) { return; }
    module.unload();
    module.tree = undefined;
    this.requestToModule.delete(module.request);
  }

  /**
   * @private
   * @param {string} arg Request or namespace.
   * @returns {ClosureModule | null} Return null if not found.
   */
  _get(arg) {
    if (typeof arg !== 'string') {
      return null;
    }

    /** @type {string} */
    let request = undefined;
    if (this.namespaceToRequest.has(arg)) {
      request = this.namespaceToRequest.get(arg);
    } else {
      request = resolveRequest(arg, this.env.context);
    }
    return this.requestToModule.get(request) || null;
  }

  /**
   * Find the specific module, return null if not found.  
   * If the module in tree but not load, load it.
   * @param {string} arg Request or namespace.
   * @returns {ClosureModule | null}
   */
  getModule(arg) {
    const module = this._get(arg);
    if (module && module.state < ModuleState.LOAD) {
      this.loadModule(module.request);
    }
    return module;
  }

  /**
   * Get the specific Namespace object.
   * @param {string} [namespace] Dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   * @param {boolean} [constructMissing]
   * @returns {Namespace | null}
   */
  getNamespace(namespace, constructMissing = false) {
    if (typeof namespace !== 'string') { return this.roots; }

    /** @type {Namespace} */
    let target = this.roots;
    travelNamespaceFromRoot(namespace, (name, fullname) => {
      const oldTarget = target;
      target = oldTarget.subs.get(name);
      if (target === undefined) {
        if (!constructMissing) {
          target = null;
          // Return false to stop travel.
          return false;
        }
        target = { name, fullname, subs: new Map() };
        oldTarget.subs.set(name, target);
      }
    });
    return target;
  }

  /**
   * Get namespace sub parts.  
   * @param {string} [namespace] Dot-separated sequence of a-z, A-Z, 0-9, _ and $.  
   * If undefined, return all root namespaces.
   * @returns {string[] | null} Return null if the namespace not found.
   */
  getSubNamespace(namespace) {
    const namespaceObj = this.getNamespace(namespace);
    if (namespaceObj) {
      return Array.from(namespaceObj.subs.keys());
    }
    return null;
  }

  /**
   * If the specific module in tree, return true.
   * @param {string} arg Request or namespace.
   * @returns {boolean}
   */
  hasModule(arg) { return this._get(arg) !== null; }

  /**
   * If the request is a library module, return true.
   * @param {string} request
   * @returns {boolean}
   * @throws {Error} Throw Error if Closure library base.js file not found.
   */
  isLibraryModule(request) {
    if (!this.libpath) {
      throw new Error('Could not find Closure library base.js file.');
    }

    return pig.fs.isSubDirectory(
      resolveRequest(request, this.env.context),
      this.libpath
    );
  }

  /**
   * Load and parse the request module from dependency param or source.  
   * If the module in tree but not loaded, load and return it;  
   * If the request not in tree and not excluded, add to source and try load it;  
   * If the module not in tree and not in filesystem, return null;  
   * If the request excluded, return null;  
   * @param {string | DependencyParam} arg Request or goog.addDependency params.
   * @param {string | Buffer} [source]
   * @returns {ClosureModule | null}
   */
  loadModule(arg, source) {
    if (!this.googpath) {
      throw new Error('Could not find Closure library base.js file.');
    }

    /** @type {string} */
    let request = undefined;
    /** @type {DependencyParam} */
    let param = undefined;

    if (typeof arg === 'string') {
      request = resolveRequest(arg, this.env.context);
    } else if (typeof arg === 'object') {
      param = arg;
      request = resolveRequest(arg.relPath, this.googpath);
    } else {
      return null;
    }

    const matchResult = this.matchRequest(request);
    if (matchResult === MatchState.EXCLUDE) {
      return null;
    } else if (matchResult === MatchState.UNKNOW) {
      // Add to source.
      this.sources.add(request);
    }

    /** @type {ClosureModule} */
    let module = this.requestToModule.get(request);
    if (module === undefined) {
      module = this.factory.create(request, this, this.env);
      this._collectErrors(this.factory);
    }
    if (module) {
      module.load(typeof source === 'string' ? source : param);
      this.addModule(module);
      this._collectErrors(module);
    }

    return module;
  }

  /**
   * Create list of goog.addDependency params.
   * @param {(module: ClosureModule) => boolean} [filter] Test each Closure module.  
   * The default function filter out all Closure library modules.
   * @param {string} [base] Defautls base.js file. 
   * @returns {DependencyParam[]}
   * @throws {Error} Throw Error if Closure library base.js file not found.
   */
  makeDependencies(
    filter = module => !this.isLibraryModule(module.request),
    base
  ) {
    /** @type {DependencyParam[]} */
    const result = [];

    for (const [, module] of this.requestToModule.entries()) {
      if (typeof filter === 'function' && filter(module)) {
        result.push(this.makeDependencyParam(module.request, base));
      }
    }

    return result;
  }

  /**
   * Create dependency param from the request module.
   * @param {string} arg Request or namespace.
   * @param {string} [base] Defautls base.js file. 
   * @returns {DependencyParam | null}
   * @throws {Error} Throw Error if Closure library base.js file not found.
   */
  makeDependencyParam(arg, base) {
    const module = this._get(arg);
    if (module === null) { return null; }

    /** @type {DependencyParam} */
    const param = {
      text: undefined,
      relPath: this.makeRelPath(arg, base),
      provides: [],
      requires: [],
      flags: {}
    };
    /** @type {string[]} */
    const flags = [];
    param.provides = Array.from(module.provides.keys());
    param.requires = Array.from(module.requires.keys());
    if (module.type === ModuleType.GOOG) {
      param.flags.module = 'goog';
      flags.push(`module: "goog"`);
    } else if (module.type === ModuleType.ES) {
      param.flags.module = 'es6';
      flags.push(`module: "es6"`);
    }
    if (module.lang !== 'es3') {
      param.flags.lang = module.lang;
      flags.push(`lang: "${module.lang}"`);
    }
    param.text = `goog.addDependency(` +
      `"${param.relPath}", ` +
      `[${param.provides.map(namespace => `"${namespace}"`).join(', ')}], ` +
      `[${param.requires.map(namespace => `"${namespace}"`).join(', ')}], ` +
      `${(flags.length > 0) ? `{ ${flags.join(', ')} }` : '{}'}` +
      `);`

    return param;
  }

  /**
   * Get the relative path from base.js to the js file.
   * @param {string} arg Request or namespace.
   * @param {string} [base] Defautls base.js file. 
   * @returns {string | null} Return null if not found.
   * @throws {Error} Throw Error if Closure library base.js file not found.
   */
  makeRelPath(arg, base) {
    let googpath = undefined;
    if (typeof base === 'string') {
      googpath = path.dirname(base);
    } else if (typeof this.googpath === 'string') {
      googpath = this.googpath;
    } else {
      throw new Error('Could not find Closure library base.js file.');
    }

    const module = this._get(arg);
    if (module) {
      // Must use unix path separator.
      return pig.pattern.unixlike(
        path.relative(googpath, module.request)
      );
    }
    return null;
  }

  /**
   * Get the request match state.  
   * If the request is a library module, return MatchState.INCLUDE;  
   * If the request is included in this.sources, return MatchState.INCLUDE;  
   * If the request is excluded in this.sources, return MatchState.EXCLUDE;  
   * If the request not included and not excluded, return MatchState.UNKNOW;  
   * @param {string} request A file, directory or glob pattern that absolute or 
   * relative from the environment context.
   * @returns {MatchState}
   */
  matchRequest(request) {
    // Should always include library module.
    if (this.isLibraryModule(request)) {
      return MatchState.INCLUDE;
    }

    return this.sources.match(request);
  }

  /**
   * @returns {void}
   */
  check() {
    // TODO: check
    // Check circular dependency;
    // Check required namespace missing;
    // Check required namespace(when required module loaded), error if requried 
    // namespace not exposed, if require is GOOG module without legacy, prompt 
    // "please add goog.module.declareLegacyNamespace";
  }

  /**
   * Reload a module that already in this tree.
   * @param {string} request
   * @param {string | Buffer} [source]
   * @returns {ClosureModule | null}
   */
  reloadModule(request, source) {
    const module = this._get(request);
    if (module !== null) {
      module.unload();
    }
    return this.loadModule(request, source);
  }

  /**
   * Scan and load all files found.
   * @param {string | string[]} [patterns] List of patterns, defaults scan all.  
   * @returns {void}
   */
  scan(patterns) {
    const result = this.sources.scan(patterns);
    // Load new files.
    if (result.added.length !== 0) {
      for (const request of result.added) {
        this.loadModule(request);
      }
    }
    // Reload modified files.
    if (result.modified.length !== 0) {
      for (const request of result.modified) {
        this.reloadModule(request);
      }
    }
    // Delete removed files.
    if (result.removed.length !== 0) {
      for (const request of result.removed) {
        this.deleteModule(request);
      }
    }
    // Delete missing files.
    if (result.missing.length !== 0) {
      for (const request of result.missing) {
        this.deleteModule(request);
      }
    }
  }
}

module.exports = ClosureTree;
