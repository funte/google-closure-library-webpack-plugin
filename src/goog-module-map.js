const path = require('path');
const fs = require('fs');
const walk = require('acorn-walk');
const acorn = require('./util/acorn-parser');
const { FileContext } = require('./util/file-context');
const pig = require('slim-pig');

/**
 * Pridefined module tag.
 */
const ModuleTag = {
  // Tag for modules in Closure-library.
  LIB: 'lib',
  // Default user tag.
  DEFAULT: 'default',
  // All user provided modules include tags with `ModuleTag.DEFAULT` and user defined. 
  USER_ALL: 'user_all'
};

class GoogModuleData {
  /** 
   * Constrct a module data.
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
   *  Possible values `ModuleTag.LIB`, `ModuleTag.DEFAULT` or user defined.
   * @param {string} modulePath The module path.
   */
  constructor(modulePath, tag = ModuleTag.DEFAULT) {
    this.path = modulePath;

    this.loaded = false;

    // Closure or ES6 files are goog module which provide namespaces by `goog.module` 
    // or `goog.declareModuleId`, else provide by `goog.provide` are not goog module.
    this.isGoogModule = null;

    // Reserved for denpendencies file read/write.
    this.tag = tag;
    if (this.tag === ModuleTag.USER_ALL) {
      throw new Error(`Invalid tag \"${this.tag}\" when create module \"${this.path}\"`);
    }

    // Acorn AST.
    this.ast = null;

    // Namepsaces required by this module.
    this.requires = new Set();
    // Namespaces defined by this mobule.
    this.provides = new Set();
  }

  unload() {
    this.loaded = false;
    this.isGoogModule = null;

    // Acorn AST.
    this.ast = null;

    this.requires.clear();
    this.provides.clear();
  }

  load() {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    // The parser's program hooks always trigged finally after all expressions
    // parsed, so if you want to find out the current node's ancestor and more,
    // you have to build an extra AST ahead the webpack parser start.
    const source = fs.readFileSync(this.path, 'utf-8');
    this.ast = acorn.buildAcornTree(source, {
      ecmaVersion: 2017,
      sourceType: 'module',
      locations: true
    });
    if (!Boolean(this.ast)) {
      throw new Error(`Acorn failed to parse \"${this.path}\"!!`);
    }
    acorn.walkAcornTree(this.ast,
      (childNode, ancestor) => {
        childNode.ancestor = ancestor;
      },
      (node, prop) => {
        const value = node[prop];
        return value == null || value === undefined || prop == 'ancestor';
      }
    );

    // Analyze the module.
    walk.simple(this.ast, {
      CallExpression: node => {
        // In acorn AST, the traditional goog.require only could be child of 
        // `ExpressionStatement` node, so if parent node is other type, it's 
        // should a goog module.
        //
        // The ancestors type list:
        // | Expression                           | Ancestor node type      |
        // | ------------------------------------ | ----------------------- |
        // | `var Bar = goog.require('Bar')`      | 'VariableDeclarator'    |
        // | `Bar = goog.require('Bar')`          | 'AssignmentExpression'  |
        // | `foo(goog.require('Bar'))`           | 'CallExpression'        |
        // | `var foo = [goog.require('Bar')]`    | 'ArrayExpression'       |
        // | `Bar = goog.require('Bar').default`  | 'MemberExpression'      |
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'goog' &&
          node.callee.property.type === 'Identifier'
        ) {
          if (!Boolean(node.ancestor)) {
            throw new Error(`Internal error, broken AST tree for \"${this.path}\"!!`);
          }
          switch (node.callee.property.name) {
            case 'require':
              if (node.ancestor.type === 'ExpressionStatement') {
                if (this.isGoogModule === null) {
                  this.isGoogModule = false;
                }
              } else {
                if (this.isGoogModule === false) {
                  const location = `${this.path}:${node.loc.start.line}:${node.loc.start.column}`;
                  throw new Error(`The \"goog.require\" return null outside the goog module at \"${location}\"!!`);
                } else if (this.isGoogModule === null) {
                  const location = `${this.path}:${node.loc.start.line}:${node.loc.start.column}`;
                  throw new Error(`The \"goog.module\" or \"goog.declareModuleId\" must go first line at \"${location}\"!!`);
                }
              }
              this.requires.add(node.arguments[0].value);
              break;
            case 'provide':
              // Unexpected `goog.privide` in goog module.
              if (this.isGoogModule === true) {
                const location = `${this.path}:${node.loc.start.line}:${node.loc.start.column}`;
                throw new Error(`Unexpected \"goog.provide\" in goog module at \"${location}\"!!`);
              }
              this.isGoogModule = false;
              this.provides.add(node.arguments[0].value);
              break;
            case 'module':
            case 'declareModuleId':
              if (this.isGoogModule === false) {
                const location = `${this.path}:${node.loc.start.line}:${node.loc.start.column}`;
                throw new Error(`Unexpected \"goog.module/declareModuleId\" at \"${location}\"!!`);
              }
              this.isGoogModule = true;
              this.provides.add(node.arguments[0].value);
              break;
          }
        }
      },
    });
  }

  reload() {
    this.unload();
    this.load();
  }

  /**
   * Test if this module match the tag.
   * @param {ModuleTag} tag To test.
   * @return {Boolean} False if not match.
   */
  isTag(tag) {
    if (ModuleTag.USER_ALL === tag) {
      return this.tag !== ModuleTag.LIB;
    } else {
      return this.tag === tag;
    }
  }
}

class GoogModuleMap {
  /** 
   * @param {schema} options See `./schema.js`.
   */
  constructor(options) {
    this.basePath = path.resolve(options.goog);
    this.baseDir = path.dirname(this.basePath);

    this._namespace2Path = new Map();
    this._path2Module = new Map();

    // File context.
    this.fileContext = new FileContext(options.sources, options.excludes);

    this.scan();

    // Analyze the Closure-library dependencies file `deps.js` and cache the 
    // namespace dependencies in Closure-library but don't analyze the module 
    // data until required.
    const googDepsPath = path.resolve(this.baseDir, 'deps.js');
    if (!fs.existsSync(googDepsPath))
      throw new Error(`Missing the Closure-library dependencies file \"${googDepsPath}\"!!`);
    const source = fs.readFileSync(googDepsPath, 'utf8')
    this.loadDeps(source, ModuleTag.LIB);
  }

  /**
   * Scan dependencies(no validation) from file context and load the modules found.
   * This method will rebuild the whole module map.
   */
  scan() {
    this._namespace2Path.clear();
    this._path2Module.clear();

    // Scan modules and load.
    this.fileContext.scan().forEach(file => {
      // Using the defualt module tag.
      // TODO: Using user defined module tag.
      this._load(file, ModuleTag.DEFAULT);
    });
  }

  /**
   * Get all files to watch from cache.
   * @return {Array<string>} List of files to watch.
   */
  filesToWatch() { return this.fileContext.filesToWatch(); }

  /**
   * Get all directories to watch from cache.
   * @return {Array<string>} List of directories to watch.
   */
  directoriesToWatch() { return this.fileContext.directoriesToWatch(); }

  /** 
   * Load dependencies from source.
   * @param {string} source The dependencies file source.
   * @param {string} tag The predefined or user defined module tag, see `ModuleTag`.
   *  Possible values `ModuleTag.LIB`, `ModuleTag.DEFAULT` or user defined.
   */
  loadDeps(source, tag = ModuleTag.DEFAULT) {
    console.log('load source: ', source.slice(0, 20));
    const depsAst = acorn.buildAcornTree(source, {
      ecmaVersion: 2017,
      sourceType: 'module',
      locations: true
    });
    if (!Boolean(depsAst)) {
      throw new Error(`Acorn failed to parse \"${depsPath}\"!!`);
    }
    walk.simple(depsAst, {
      CallExpression: node => {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'goog' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'addDependency'
        ) {
          const modulePath = path.resolve(this.baseDir, node.arguments[0].value);
          if (fs.existsSync(modulePath)) {
            // Add user module path to file context.
            if (tag !== ModuleTag.LIB)
              this.fileContext.include(modulePath);

            var moduleData = new GoogModuleData(modulePath, tag);
            // Analyze provided namespaces.
            node.arguments[1].elements.forEach(arg => {
              this._namespace2Path.set(arg.value, modulePath);
              moduleData.provides.add(arg.value);
            });
            // Analyze required namespaces.
            node.arguments[2].elements.forEach(arg => {
              moduleData.requires.add(arg.value);
            });

            this._path2Module.set(modulePath, moduleData);
          }
        }
      }
    });
  }

  /** 
   * Save dependencies with the specific tag.
   * @param {string} from The dependencies file path to save, using to generate 
   *   relative path for `goog.addDependency`.
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
   *   Possible values `ModuleTag.LIB`, `ModuleTag.DEFAULT`, `ModuleTag.USER_ALL` or user defined.
   * @return {string} The dependencies file source.
   */
  writeDeps(from, tag = ModuleTag.USER_ALL) {
    let source = ``;

    let modulesPath = new Set();
    for (let moduleData of this._path2Module.values()) {
      if (moduleData.isTag(tag)) {
        modulesPath.add(moduleData.path);

        const relative = pig.str.unixlike(path.relative(from, moduleData.path));
        const provides = Array.from(moduleData.provides).map(
          namespace => `\"${namespace}\"`
        );
        const requires = Array.from(moduleData.requires).map(
          namespace => `\"${namespace}\"`
        );
        let opt = [];
        if (moduleData.isGoogModule) {
          opt.push(`\"module\": \"goog\"`);
        }
        const line = `goog.addDependency(\"${relative}\", [${provides.join(', ')}], [${requires.join(', ')}], {${opt.join(', ')}});\n`;
        source += line;
      }
    }

    return source;
  }

  /** 
   * Get module data from path, if the module not in map, load it with the tag.
   * @param {string} modulePath The module path.
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
   *   Possible values `ModuleTag.LIB`, `ModuleTag.DEFAULT` or user defined.
   * @return {GoogModuleData} Module data or null.
   */
  requireModuleByPath(modulePath, tag = ModuleTag.DEFAULT) {
    modulePath = path.resolve(modulePath);

    var moduleData = null;

    if (!this.has(modulePath)) {
      // If not in map, load it.
      moduleData = this._load(modulePath, tag);
    } else {
      moduleData = this._path2Module.get(modulePath);
    }

    return moduleData;
  }

  /** 
   * Get module data from a provided namespace, if not in map throw an Error.
   * @param {string} namespace The namespace to search.
   * @return {GoogModuleData} Module data or null.
   */
  requireModuleByName(namespace) {
    const modulePath = this._namespace2Path.get(namespace);
    if (!Boolean(modulePath)) {
      throw new Error(`Unknow namespace ${namespace}!!`);
    }

    return this.requireModuleByPath(modulePath);
  }

  /**
   * Check if in module map.
   * @return {Boolean} False if not in module map.
   */
  has(modulePath) { return this._path2Module.has(modulePath); }

  /**
   * Update(reload) module in map.
   * This method will check if file context has cached the module path, if cached
   * and not in module map, load it, else skip it. 
   * @param {string} modulePath Module of path to update. 
   * @param {string} tag The predefined or user defined module tag, see `ModuleTag`.
   *   Possible values `ModuleTag.LIB`, `ModuleTag.DEFAULT` or user defined.
   */
  updateModule(modulePath, tag = ModuleTag.DEFAULT) {
    modulePath = path.resolve(modulePath);
    if (!this.has(modulePath)) {
      if (this.fileContext.has(modulePath)) {
        // If not in map, load it.
        this._load(modulePath, tag);
      }
    } else {
      this._reload(modulePath, tag);
    }
  }

  /**
   * Delete module from map.
   * @param {string} modulePath Module of path to delete.
   */
  deleteModule(modulePath) {
    if (this.has(modulePath)) {
      let moduleData = this._path2Module.get(modulePath);
      if (moduleData && moduleData.loaded) {
        moduleData.provides.forEach(namespace => {
          this._namespace2Path.delete(namespace);
        });
      }
      this._path2Module.delete(modulePath);
    }
  }

  /**
   * Get modules with tag.
   * @param {ModuleTag} tag The predefined or user defined module tag, see `ModuleTag`.
   *   Accept all `ModuleTag` values.
   * @return {Array<ModuleData>} List of modules with the tag.
   */
  getModules(tag = ModuleTag.DEFAULT) {
    var moduleDataFound = [];
    this._path2Module.forEach(moduleData => {
      if (moduleData.hit(tag))
      moduleDataFound.add(moduleData);
    });
    return moduleDataFound;
  }

  _reload(modulePath, tag) {
    if (!this.has(modulePath)) {
      // If not in map, load it.
      this._load(modulePath, tag);
    } else {
      var moduleData = this._path2Module.get(modulePath);
      moduleData.provides.forEach(namespace => {
        this._namespace2Path.delete(namespace);
      });
      moduleData.reload();
      moduleData.provides.forEach(namespace => {
        this._namespace2Path.set(namespace, modulePath);
      });
    }
  }

  _load(modulePath, tag) {
    var moduleData = new GoogModuleData(modulePath, tag);
    this._path2Module.set(modulePath, moduleData);

    moduleData.load();
    moduleData.provides.forEach(namespace => {
      this._namespace2Path.set(namespace, modulePath);
    });

    return moduleData;
  }
}

module.exports = {
  ModuleTag,
  GoogModuleData,
  GoogModuleMap
};
