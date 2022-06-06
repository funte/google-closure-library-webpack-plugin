import path from 'path';
import pig from 'slim-pig';

import { ClosureModuleFactory } from './ClosureModuleFactory';
import { instanceOfDependencyParam, ModuleState, ModuleType } from './ClosureModule';
import { existsSync } from '../utils/exists';
import { PluginError } from '../errors/PluginError';
import { resolveRequest } from '../utils/resolveRequest';
import { MatchState, Sources } from '../source/Sources';
import { travelNamespaceFromRoot } from '../utils/travelNamespace';

import { CircularReferenceError } from '../errors/CircularReferenceError';
import { BadRequire } from '../errors/BadRequire';
import { NamespaceDuplicateError } from '../errors/NamespaceDuplicateError';

import { ClosureModule, DependencyParam } from './ClosureModule';
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

  public readonly libpath: string;
  public readonly googpath: string;
  public readonly basefile: string;
  public readonly depsfile: string;

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
    } else {
      let libpath = resolveRequest('node_modules/google-closure-library', this.env.context);
      if (!existsSync(libpath, this.env.fs)) {
        throw new PluginError('Cannot find Closure library base.js file.');
      }
      const lstatSync = this.env.fs.lstatSync || this.env.fs.statSync;
      // Get the real library location.
      while (lstatSync(libpath).isSymbolicLink()) {
        libpath = this.env.fs.readlinkSync(libpath);
      }
      this.basefile = resolveRequest('closure/goog/base.js', libpath);
      if (!existsSync(this.basefile, this.env.fs)) {
        throw new PluginError('Cannot find Closure library base.js file.');
      }
    }
    this.googpath = path.dirname(this.basefile);
    this.libpath = resolveRequest('../../', this.googpath);
    this.depsfile = this.googpath + path.sep + 'deps.js';

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

  /** 
   * Check Closure tree.  
   * This will auto perform after {@link ClosureTree.scan}.  
   * @see https://github.com/google/closure-library/blob/c3b90b/closure-deps/lib/depgraph.js#L336  
   * @throws {@link CircularReferenceError} Throw CircularReferenceError if has circular reference.  
   * @throws {@link BadRequire} Throw BadRequire if GOOG module not has exposed namespace but connect PROVIDE module.  
   * @throws {@link PluginError} Throw PluginError if the required namespace missing or load failed.  
   */
  check(): void {
    let index = 0;
    // Store DFS number.
    const indexMap: Map<ClosureModule, { index: number, anyPROVIDE: boolean }> = new Map();
    // Store potentially strongly conected modules.
    const moduleStack: Set<any> = new Set();

    /**
     * @param options.anyPROVIDE - True if connect any PROVIDE module.
     */
    const innerCheck = (module: ClosureModule, anyPROVIDE: boolean): number => {
      const thisIndex = index++;
      indexMap.set(module, { index: thisIndex, anyPROVIDE });
      // Is current module has exposed namespace.
      let lowIndex = thisIndex;

      moduleStack.add(module);

      let requiredModule: any = undefined;
      for (const namespace of module.requires.keys()) {
        requiredModule = this.getModule(namespace);
        // Error if the required namespace missing or load failed.
        if (!requiredModule) {
          throw new PluginError(`Unknow namespace ${namespace} or the module load failed.`);
        }

        // Error if require self provided namespace.
        if (module.provides.has(namespace)) {
          const loc: any = module.requires.get(namespace)?.expr?.loc;
          throw new BadRequire({
            file: module.request, loc,
            desc: `cannot require self provided namespace.`
          });
        }

        // First occurs a PROVIDE moudle, flag all connected modules in stack.
        const requirePROVIDE = requiredModule.type === ModuleType.PROVIDE;
        if (!anyPROVIDE && requirePROVIDE) {
          // @ts-ignore
          moduleStack.forEach(module => { indexMap.get(module).anyPROVIDE = true; });
        }

        const requiredModuleIndex = indexMap.get(requiredModule)?.index;
        if (typeof requiredModuleIndex !== 'number') {
          lowIndex = Math.min(
            lowIndex,
            innerCheck(requiredModule, anyPROVIDE || requirePROVIDE)
          );
        } else if (moduleStack.has(requiredModule)) {
          lowIndex = Math.min(lowIndex, requiredModuleIndex);
        }
      }

      // Error if GOOG module not has exposed namespace but connect PROVIDE module.
      // Except all Closure library modules.
      if (module.type === ModuleType.GOOG && !module.legacy
        && indexMap.get(module)?.anyPROVIDE
      ) {
        if (module.state === ModuleState.CACHE) {
          this.loadModule(module.request);
        }
        if (!module.legacy) {
          if (this.isLibraryModule(module)) {
            // Show this Closure library warning if allowed.
            if (['show', 'hideUser'].includes(this.env.warningLevel)) {
              const warning = new BadRequire({
                file: module.request,
                desc: `detect requre a PROVIDE module and the namespace in this module not exposed,` +
                  ` but this plugin will fix it`
              });
              this.warnings.push(warning);
            }

            // Set legacy flag and fix it by reprasing implicit namespaces.
            module.legacy = true;
            module.parseImplicities();
          } else {
            const requireStack = Array.from(moduleStack).map(module => module.request);
            if (requiredModule) {
              requireStack.push(requiredModule.request);
            }
            throw new BadRequire({
              file: module.request,
              desc: `detect require a PROVIDE module but namespace in this module not exposed,` +
                ` maybe you forget add goog.module.declareLegacyNamespace,` +
                ` see the require stack: \n${requireStack.join('\n')} `
            });
          }
        }
      }

      // Found strongly conected modules.
      if (lowIndex === thisIndex) {
        const modules = [...moduleStack];
        const scc: any[] = [];
        for (let i = modules.length - 1; i > -1; i--) {
          scc.push(modules[i]);
          moduleStack.delete(modules[i]);
          if (modules[i] === module) {
            break;
          }
        }
        if (scc.length > 1) {
          throw new CircularReferenceError({
            stack: modules.map(module => module.request).join('\n')
          });
        }
      }

      return lowIndex;
    };

    for (const module of this.requestToModule.values()) {
      if (module.state < ModuleState.CACHE) {
        new PluginError(`Unload module ${module.request}.`);
      }
      // If current Closure module not checked.
      if (!indexMap.has(module)) {
        innerCheck(module, module.type === ModuleType.PROVIDE);
      }
    }
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

    let request = this.namespaceToRequest.get(arg);
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
   * @throws {@link PluginError} Throw PluginError if Closure library base.js file not found.
   */
  isLibraryModule(arg: string | ClosureModule): boolean {
    if (!this.libpath) {
      throw new PluginError('Could not find Closure library base.js file.');
    }

    let request: string;
    if (arg instanceof ClosureModule) {
      request = arg.request;
    } else if (typeof arg === 'string') {
      request = arg;
    } else {
      return false;
    }
    return pig.fs.isSubDirectory(
      resolveRequest(request, this.env.context),
      this.libpath
    );
  }

  /**
   * If the namespace is a library namespace, return true.
   * @param namespace - Full namespace, dot-separated sequence of a-z, A-Z, 0-9, _ and $.
   * @throws {@link PluginError} Throw PluginError if Closure library base.js file not found.
   */
  isLibraryNamespace(namespace: string): boolean {
    let result = false;
    travelNamespaceFromRoot(namespace, (name, fullname) => {
      const provider = this._get(fullname);
      // If not found, return false to stop the travel.
      if (!provider) { return false; }
      result = this.isLibraryModule(provider);
    });
    return result;
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
   * @throws {@link PluginError} Throw PluginError if Closure library base.js file not found.
   */
  makeDependencies(
    filter: (module: ClosureModule) => boolean = module => !this.isLibraryModule(module),
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
   * @throws {@link PluginError} Throw PluginError if Closure library base.js file not found.
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
      `);`;
    return param;
  }

  /**
   * Get the relative path from base.js to the js file.
   * @param arg - Request or namespace.
   * @param base - Defautls base.js file. 
   * @throws {@link PluginError} Throw PluginError if Closure library base.js file not found.
   */
  makeRelPath(arg: string, base?: string): string | null {
    let googpath: string;
    if (typeof base === 'string') {
      googpath = path.dirname(base);
    } else if (typeof this.googpath === 'string') {
      googpath = this.googpath;
    } else {
      throw new PluginError('Could not find Closure library base.js file.');
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
    let changed = false;
    const result = this.sources.scan(patterns);
    // Load new files.
    if (result.added.size) {
      changed = true;
      result.added.forEach(file => this.loadModule(file));
    }
    // Reload modified files.
    if (result.modified.size) {
      changed = true;
      result.modified.forEach(file => this.reloadModule(file));
    }
    // Delete removed files.
    if (result.removed.size) {
      changed = true;
      result.removed.forEach(file => this.deleteModule(file));
    }
    // Delete missing files.
    if (result.missing.size) {
      changed = true;
      result.missing.forEach(file => this.deleteModule(file));
    }
    if (changed) {
      // Reconstruct all namespace object.
      this.roots.subs.clear();
      for (const namespace of this.namespaceToRequest.keys()) {
        this.getNamespaceObject(namespace, true);
      }

      this.check();
    }
  }
}
