const path = require('path');
const fs = require('fs');
const walk = require('acorn-walk');
const acorn = require('./util/acorn-parser');
const FileContext = require('./util/file-context');

/**
 * Pridefined module tag.
 */
const ModuleTag = {
  // Tag for modules in Closure-library.
  LIB: 'lib',
  // Default use tag.
  DEFAULT: 'default',
  // All user provided modules. 
  USER_ALL: 'user_all'
};

class GoogModuleData {
  /** 
   * Constrct a module data.
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
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
    this.ast = acorn.buildAcornTree(this.path, {
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
}

class GoogModuleMap {
  /** 
   * @param {schema} options See `./schema.js`.
   */
  constructor(options) {
    this.basePath = path.resolve(options.goog);
    this.baseDir = path.dirname(this.basePath);

    this.namespace2Path = new Map();
    this.path2Module = new Map();

    this.files_ = new FileContext(options.sources, options.excludes);

    this.scan();

    // TODO: serparate out this code.
    // Analyze the Closure-library dependencies file `deps.js` and cache the 
    // namespace dependencies in Closure-library but don't analyze the module 
    // data until required.
    const googDepsPath = path.resolve(this.baseDir, 'deps.js');
    this.loadDepsFile(googDepsPath, ModuleTag.LIB);
  }

  /**
   * Scan dependencies(no validation).
   */
  scan() {
    this.namespace2Path.clear();
    this.path2Module.clear();

    // Analyze source files.
    this.files_.scan().forEach(file => {
      // Using defualt module tag.
      // TODO: Using user defined module tag.
      this.load_(file, ModuleTag.DEFAULT);
    });
  }

  /**
   * Get all files to watch from cache.
   * @return {Array.<string>} List of files to watch.
   */
  filesToWatch() { return this.files_.filesToWatch(); }

  /**
   * Get all directories to watch from cache.
   * @return {Array.<string>} List of directories to watch.
   */
  directoriesToWatch() { return this.files_.directoriesToWatch(); }

  /** 
   * Load dependencies file.
   * @param {string} depsPath File path to read.
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
   */
  loadDepsFile(depsPath, tag = ModuleTag.DEFAULT) {
    if (!fs.existsSync(depsPath)) {
      throw new Error(
        `Missing the dependencies file \"${depsPath}\"!!`
      );
    }

    const depsAst = acorn.buildAcornTree(depsPath, {
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
            var moduleData = new GoogModuleData(modulePath, tag);
            // Analyze provided namespaces.
            node.arguments[1].elements.forEach(arg => {
              this.namespace2Path.set(arg.value, modulePath);
              moduleData.provides.add(arg.value);
            });
            // Analyze required namespaces.
            node.arguments[2].elements.forEach(arg => {
              moduleData.requires.add(arg.value);
            });

            this.path2Module.set(modulePath, moduleData);
          }
        }
      }
    });
  }

  /** 
   * Save dependencies with the specific tag to file.
   * @param {string} depsPath File path to write.
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
   */
  SaveDepsFile(depsPath, tag = ModuleTag.USER_ALL) {
    // TODO
  }

  /** 
   * Get module data from path, if the module not in map, load it.
   * @param {string} modulePath The module path.
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
   * @return {GoogModuleData} Module data or null.
   */
  requireModuleByPath(modulePath, tag = ModuleTag.DEFAULT) {
    modulePath = path.resolve(modulePath);

    var moduleData = null;

    if (!this.path2Module.has(modulePath)) {
      // If not in map, load it.
      moduleData = this.load_(modulePath, tag);
    } else {
      moduleData = this.path2Module.get(modulePath);
    }

    return moduleData;
  }

  /** 
   * Get module data from a provided namespace, if not in map throw an Error.
   * @param {string} namespace The namespace to search.
   * @return {GoogModuleData} Module data or null.
   */
  requireModuleByName(namespace) {
    const modulePath = this.namespace2Path.get(namespace);
    if (!Boolean(modulePath)) {
      throw new Error(`Unknow namespace ${namespace}!!`);
    }

    return this.requireModuleByPath(modulePath);
  }

  /**
   * Update(reload) modules, if not in map, load it.
   * @param {Array.<string>} modulesPath List of modules path to update. 
   * @param {string} tag The predefined or user defined module tag, see ModuleTag.
   */
  updateModules(modulesPath, tag = ModuleTag.DEFAULT) {
    modulesPath = modulesPath || [];
    modulesPath = Array.isArray(modulesPath) ? modulesPath : [modulesPath];
    modulesPath.forEach(modulePath => {
      modulePath = path.resolve(modulePath);
      if (!this.path2Module.has(modulePath)) {
        // If not in map, load it.
        this.load_(modulePath, tag);
      } else {
        this.reload_(modulePath);
      }
    });
  }

  /**
   * Delete modules.
   */
  deleteModules(modulesPath) {
    modulesPath = modulesPath || [];
    modulesPath = Array.isArray(modulesPath) ? modulesPath : [modulesPath];
    modulesPath.forEach(modulePath => {
      if (this.path2Module.has(modulePath)) {
        let moduleData = this.path2Module.get(modulePath);
        if (moduleData && moduleData.loaded) {
          moduleData.provides.forEach(namespace => {
            this.namespace2Path.delete(namespace);
          });
        }
        this.path2Module.delete(modulePath);
      }
    });
  }

  reload_(modulePath, tag) {
    if (!this.path2Module.has(modulePath)) {
      // If not in map, load it.
      this.load_(modulePath, tag);
    } else {
      var moduleData = this.path2Module.get(modulePath);
      moduleData.provides.forEach(namespace => {
        this.namespace2Path.delete(namespace);
      });
      moduleData.reload();
      moduleData.provides.forEach(namespace => {
        this.namespace2Path.set(namespace, modulePath);
      });
    }
  }

  load_(modulePath, tag) {
    var moduleData = new GoogModuleData(modulePath, tag);
    this.path2Module.set(modulePath, moduleData);

    moduleData.load();
    moduleData.provides.forEach(namespace => {
      this.namespace2Path.set(namespace, modulePath);
    });

    return moduleData;
  }
}

module.exports = GoogModuleMap;
