const path = require('path');
const fs = require('fs');
const walk = require('acorn-walk');
const astUtils = require('./ast-utils');
const scanSource = require('./scan-source');

class GoogModuleData {
  /** 
   * Constrct a module data.
   * @param {string} modulePath The module path.
   */
  constructor(modulePath) {
    this.loaded = false;

    this.path = modulePath;
    // Closure or ES6 files are goog module which provide namespaces by `goog.module` 
    // or `goog.declareModuleId`, else provide by `goog.provide` are not goog module.
    this.isGoogModule = null;
    this.requires = new Set();
    this.provides = new Set();
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

    // Scan source files.
    var sourceFiles = scanSource(options.sources, options.excludes);

    // Analyze source files.
    sourceFiles.forEach(sourcePath => {
      this.requireModuleByPath(sourcePath);
    });

    // TODO: serparate out this code.
    // Analyze the Closure-library dependencies file `deps.js` and cache the 
    // namespace dependencies in Closure-library but don't analyze the module 
    // data until required.
    const googDepsPath = path.resolve(this.baseDir, 'deps.js');
    if (!fs.existsSync(googDepsPath)) {
      throw new Error(
        `Missing the Closure-library dependencies file: \"${googDepsPath}\"!!`
      );
    }
    const googDepsAst = astUtils.buildAcornTree(googDepsPath, {
      ecmaVersion: 2017
    });
    walk.simple(googDepsAst, {
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
            var moduleData = new GoogModuleData(modulePath);
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
   * Get module data from path.
   * @param {string} modulePath The module path.
   * @return {GoogModuleData} Module data or null.
   */
  requireModuleByPath(modulePath) {
    modulePath = path.resolve(modulePath);

    var moduleData = this.path2Module.get(modulePath);
    if (!Boolean(moduleData)) {
      moduleData = new GoogModuleData(modulePath);
      this.path2Module.set(modulePath, moduleData);
    }

    if (!moduleData.loaded) {
      this.load_(moduleData);
    }

    return moduleData;
  }

  /** 
   * Get module data from a provided namespace.
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

  load_(moduleData) {
    moduleData.loaded = true;

    // The parser's program hooks always trigged finally after all expressions
    // parsed, so if you want to find out the current node's ancestor and more,
    // you have to build an extra AST ahead the webpack parser start.
    moduleData.ast = astUtils.buildAcornTree(moduleData.path, {
      ecmaVersion: 2017,
      sourceType: 'module',
      locations: true
    });
    if (!Boolean(moduleData.ast)) {
      throw new Error(`Acorn failed to parse \"${moduleData.path}\"!!`);
    }
    astUtils.walkAcornTree(moduleData.ast,
      (childNode, ancestor) => {
        childNode.ancestor = ancestor;
      },
      (node, prop) => {
        const value = node[prop];
        return value == null || value === undefined || prop == 'ancestor';
      }
    );

    // Analyze the module.
    walk.simple(moduleData.ast, {
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
            throw new Error(`Internal error, broken AST tree for \"${moduleData.path}\"!!`);
          }
          switch (node.callee.property.name) {
            case 'require':
              if (node.ancestor.type === 'ExpressionStatement') {
                if (moduleData.isGoogModule === null) {
                  moduleData.isGoogModule = false;
                }
              } else {
                if (moduleData.isGoogModule === false) {
                  const location = `${moduleData.path}:${node.loc.start.line}:${node.loc.start.column}`;
                  throw new Error(`The \"goog.require\" return null outside the goog module at \"${location}\"!!`);
                } else if (moduleData.isGoogModule === null) {
                  const location = `${moduleData.path}:${node.loc.start.line}:${node.loc.start.column}`;
                  throw new Error(`The \"goog.module\" or \"goog.declareModuleId\" must go first line at \"${location}\"!!`);
                }
              }
              moduleData.requires.add(node.arguments[0].value);
              break;
            case 'provide':
              // Unexpected `goog.privide` in goog module.
              if (moduleData.isGoogModule === true) {
                const location = `${moduleData.path}:${node.loc.start.line}:${node.loc.start.column}`;
                throw new Error(`Unexpected \"goog.provide\" in goog module at \"${location}\"!!`);
              }
              moduleData.isGoogModule = false;
              moduleData.provides.add(node.arguments[0].value);
              this.namespace2Path.set(node.arguments[0].value, moduleData.path);
              break;
            case 'module':
            case 'declareModuleId':
              if (moduleData.isGoogModule === false) {
                const location = `${moduleData.path}:${node.loc.start.line}:${node.loc.start.column}`;
                throw new Error(`Unexpected \"goog.module/declareModuleId\" at \"${location}\"!!`);
              }
              moduleData.isGoogModule = true;
              moduleData.provides.add(node.arguments[0].value);
              this.namespace2Path.set(node.arguments[0].value, moduleData.path);
              break;
          }
        }
      },
    });
  }
}

module.exports = GoogModuleMap;
