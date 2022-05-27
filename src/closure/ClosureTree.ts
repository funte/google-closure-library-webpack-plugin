import path from 'path';
import pig from 'slim-pig';

import { ClosureModuleFactory } from './ClosureModuleFactory';
import { instanceOfDependencyParam, ModuleState, ModuleType } from './ClosureModule';
import { PluginError } from '../errors/PluginError';
import { resolveRequest } from '../utils/resolveRequest';
import { MatchState, Sources } from '../source/Sources';
import { travelNamespaceFromRoot } from '../utils/travelNamespace';

import { NamespaceDuplicateError } from '../errors/NamespaceDuplicateError';

import type { ClosureModule, DependencyParam } from './ClosureModule';
import type { Environment } from '../Environment';

/** Namespace object that used mange and present namespace structure. */
export interface NamespaceObject {
  /** This namespace full name last part. */
  name: string;
  /** This namespace name. */
  fullname: string;
  /** Sub parts fullname and namespace object. */
  subs: Map<string, NamespaceObject>;
}
/** Store all root namespace objects, e.g. goog */
export const RootsObject: NamespaceObject = {
  name: undefined,
  fullname: undefined,
  subs: new Map()
} as any;

export class ClosureTree {
  public readonly factory = new ClosureModuleFactory();

  public readonly env: Environment;

  public readonly libpath: string | undefined;
  public readonly googpath: string | undefined;
  public readonly basefile: string | undefined;
  public readonly depsfile: string | undefined;

  public readonly namespaceToRequest: Map<string, string> = new Map();
  public readonly requestToModule: Map<string, ClosureModule> = new Map();
  public readonly roots: NamespaceObject = RootsObject;

  public readonly sources: Sources;

  /** Errors when parsing Closure module. */
  public readonly errors: PluginError[] = [];
  /** Warnings when parsing Closure module. */
  public readonly warnings: PluginError[] = [];

  /**
   * @param options.base - Path to Closure library base.js file, must be absolute or relative from the environment context.
   * @param options.sources - List of absolute patterns, or relative from the environment context.
   */
  constructor(options: {
    base?: string,
    sources: string | string[],
    env: Environment
  }) {
    const { base, sources, env } = options;

    this.env = env;

    this.sources = new Sources(sources, env.context, env.fs);

    if (typeof base === 'string') {
      this.basefile = resolveRequest(base, env.context);
    } else if (typeof env.NODE_MODULES === 'string') {
      this.basefile = resolveRequest(
        'google-closure-library/closure/goog/base.js',
        env.NODE_MODULES);
    } else {
      this.warnings.push(
        new PluginError('Could not find Closure library base.js file.')
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

    this.scan();
  }

  private _collectErrors(obj: { errors: PluginError[], warnings: PluginError[] }): void {
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

  addModule(module: ClosureModule): void {
    if (this.requestToModule.has(module.request)) { return; }

    this._collectErrors(module);

    this.requestToModule.set(module.request, module);
    for (const [name,] of module.provides.entries()) {
      this.addProvide(name, module);
    }
  }

  /**
   * @param namespace - Full namespace, dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   */
  addProvide(namespace: string, module: ClosureModule) {
    const provider = this._get(namespace);
    if (provider && provider !== module) {
      const loc: any = provider.provides.get(namespace)?.expr?.loc;
      const error = new NamespaceDuplicateError({
        file: provider.request, loc,
        namespace,
        isProvide: true
      });
      this.errors.push(error);
      return;
    }

    this.namespaceToRequest.set(namespace, module.request);

    // Construct the namespace.
    this.getNamespaceObject(namespace, true);
  }

  clear(): void {
    this.namespaceToRequest.clear();
    this.requestToModule.clear();
    this.roots.subs.clear();
    this.sources.clear();
    this.errors.length = 0;
    this.warnings.length = 0;
  }

  /**
   * Unload and destory the module from tree, also remove its provides. 
   * @param arg - Request or namespace.
   */
  deleteModule(arg: string): void {
    if (typeof arg !== 'string') { return; }

    const module = this._get(arg);
    if (!module) { return; }
    module.unload();
    module.tree = undefined;
    this.requestToModule.delete(module.request);
  }

  /**
   * @param arg - Request or namespace.
   */
  private _get(arg: string): ClosureModule | null {
    if (typeof arg !== 'string') { return null; }

    let request = this.namespaceToRequest.get(arg)
    if (request === undefined) {
      request = resolveRequest(arg, this.env.context);
    }
    return this.requestToModule.get(request) || null;
  }

  /**
   * Find the specific module, return null if not found.  
   * If the module in tree but not load, load it.  
   * @param arg - Request or namespace.
   */
  getModule(arg: string): ClosureModule | null {
    const module = this._get(arg);
    if (module && module.state < ModuleState.LOAD) {
      this.loadModule(module.request);
    }
    return module;
  }

  /**
   * Get the specific Namespace object.
   * @param namespace - Full namespace, dot-separated sequence of a-z, A-Z, 0-9, _ and $.  
   * Defautls return the {@link RootsObject}.  
   */
  getNamespaceObject(
    namespace?: string,
    constructMissing: boolean = false
  ): NamespaceObject | null {
    if (typeof namespace !== 'string') { return this.roots; }

    let target: NamespaceObject | null = this.roots;
    travelNamespaceFromRoot(namespace, (name, fullname) => {
      const oldTarget = target as NamespaceObject;
      target = oldTarget.subs.get(name) || null;
      if (!target) {
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
   * Get namespace all sub parts.  
   * @param namespace - Full namespace, dot-separated sequence of a-z, A-Z, 0-9, _ and $.  
   * Defaults return all root namespaces(subs in the {@link RootsObject}).  
   * @returns Return null if the namespace not found.
   */
  getSubNamespace(namespace?: string): string[] | null {
    const namespaceObj = this.getNamespaceObject(namespace);
    if (namespaceObj) {
      return Array.from(namespaceObj.subs.keys());
    }
    return null;
  }

  /**
   * If the specific module in tree, return true.
   * @param arg - Request or namespace.
   */
  hasModule(arg: string): boolean { return this._get(arg) !== null; }

  /**
   * If the request is a library module, return true.
   * @throws {@link Error} Throw Error if Closure library base.js file not found.
   */
  isLibraryModule(request: string): boolean {
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
   * @param arg - Request or goog.addDependency params.
   */
  loadModule(
    arg: string | DependencyParam,
    source?: string | Buffer
  ): ClosureModule | null {
    if (!this.googpath) {
      throw new Error('Could not find Closure library base.js file.');
    }

    let request: string;
    let param: DependencyParam | undefined = undefined;

    if (typeof arg === 'string') {
      request = resolveRequest(arg, this.env.context);
    } else if (instanceOfDependencyParam(arg)) {
      request = resolveRequest(arg.relPath, this.googpath);
      param = arg;
    } else {
      // Return null if request not found.
      return null;
    }

    const matchResult = this.matchRequest(request);
    if (matchResult === MatchState.EXCLUDE) {
      return null;
    } else if (matchResult === MatchState.UNKNOW) {
      // Add to source.
      this.sources.add(request);
    }

    let module = this._get(request);
    if (!module) {
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
   * @param filter - Test each Closure module, defaults filter out all Closure library modules.  
   * @param base - Defautls base.js file. 
   * @throws {@link Error} Throw Error if Closure library base.js file not found.
   */
  makeDependencies(
    filter: (module: ClosureModule) => boolean = module => !this.isLibraryModule(module.request),
    base?: string
  ): DependencyParam[] {
    const result: DependencyParam[] = [];

    Array.from(this.requestToModule.values())
      .filter(filter)
      .forEach(module => {
        const dependencyparam = this.makeDependencyParam(module.request, base);
        if (dependencyparam) { result.push(dependencyparam); }
      });

    return result;
  }

  /**
   * Create dependency param from the request module.
   * @param arg - Request or namespace.
   * @param base - Defautls base.js file. 
   * @throws {@link Error} Throw Error if Closure library base.js file not found.
   */
  makeDependencyParam(arg: string, base?: string): DependencyParam | null {
    const module = this._get(arg);
    if (module === null) { return null; }

    const relPath = this.makeRelPath(arg, base);
    if (relPath === null) { return null; }
    const param: DependencyParam = {
      text: '',
      relPath,
      provides: [],
      requires: [],
      flags: {}
    };
    const flags: string[] = [];
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
   * @param arg - Request or namespace.
   * @param base - Defautls base.js file. 
   * @throws {@link Error} Throw Error if Closure library base.js file not found.
   */
  makeRelPath(arg: string, base?: string): string | null {
    let googpath: string;
    if (typeof base === 'string') {
      googpath = path.dirname(base);
    } else if (typeof this.googpath === 'string') {
      googpath = this.googpath;
    } else {
      throw new Error('Could not find Closure library base.js file.');
    }

    const module = this._get(arg);
    if (module) {
      // Must use POSIX path separator.
      return pig.pattern.unixlike(path.relative(googpath, module.request));
    }
    return null;
  }

  /**
   * Get the request match state.  
   * If the request is a library module, always return MatchState.INCLUDE;  
   * If the request is included in this.sources, return MatchState.INCLUDE;  
   * If the request is excluded in this.sources, return MatchState.EXCLUDE;  
   * If the request not included and not excluded, return MatchState.UNKNOW;  
   * @param request - A file, directory or glob pattern that absolute or relative from the environment context.
   */
  matchRequest(request: string): MatchState {
    // Should always include library module.
    if (this.isLibraryModule(request)) {
      return MatchState.INCLUDE;
    }

    return this.sources.match(request);
  }

  // check(): void {
  //   // TODO: check
  //   // Check circular dependency;
  //   // Check required namespace missing;
  //   // Check required namespace of loaded module, error if requried 
  //   // namespace not exposed, if require is GOOG module without legacy, prompt 
  //   // "please add goog.module.declareLegacyNamespace";
  // }

  /** Reload a module that already in this tree. */
  reloadModule(request: string, source?: string | Buffer): ClosureModule | null {
    const module = this._get(request);
    if (module !== null) {
      module.unload();
    }
    return this.loadModule(request, source);
  }

  /**
   * Scan and load all files found.
   * @param patterns - List of patterns, defaults scan all.  
   */
  scan(patterns?: string | string[]): void {
    const result = this.sources.scan(patterns);
    // Load new files.
    result.added.forEach(file => this.loadModule(file));
    // Reload modified files.
    result.modified.forEach(file => this.reloadModule(file));
    // Delete removed files.
    result.removed.forEach(file => this.deleteModule(file));
    // Delete missing files.
    result.missing.forEach(file => this.deleteModule(file));
  }
}
