const path = require('path');
const fs = require('fs');
const walk = require('acorn-walk');
const astUtils = require('./ast-utils');
const scanSource = require('./scan-source');

class GoogModuleData {
  /** 
   * Constrct a module data for a Closure file.
   * @param {string} modulePath the Closure file's full path.
   * @param {string} isGoogModule Closure or ES6 files are goog module which 
   *  provide namespaces by goog.module or goog.declareModuleId; else provide
   *  by goog.provide are not goog module.
   */
  constructor(modulePath, isGoogModule = null) {
    this.cooked = false;

    this.path = modulePath;
    this.isGoogModule = isGoogModule;
    this.requires = new Set();
    this.provides = new Set();
  }
}

class GoogModuleMap {
  constructor(options) {
    this.basePath = path.resolve(options.goog);
    this.baseDir = path.dirname(this.basePath);
    this.namespace2Path = new Map();
    this.path2Module = new Map();

    // find js source files.
    var sourceFiles = scanSource(options.sources, options.excludes);

    // analyze js source files.
    sourceFiles.forEach(sourcePath => {
      this.requireModuleByPath(sourcePath);
    });

    // analyze the Closure library dependencies file deps.js
    const googDepsPath = path.resolve(this.baseDir, 'deps.js');
    if (!fs.existsSync(googDepsPath)) {
      throw new Error(
        `Unable to locate the Closure library dependencies file from "${googDepsPath}"!!`
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
            // resolve provides.
            node.arguments[1].elements.forEach(arg => {
              this.namespace2Path.set(arg.value, modulePath);
              moduleData.provides.add(arg.value);
            });
            // resolve requires.
            node.arguments[2].elements.forEach(arg => {
              moduleData.requires.add(arg.value);
            });

            // this.require_(moduleData);
            this.path2Module.set(module, moduleData);
          }
        }
      }
    });
  }

  /** 
   * Get cooked module data from a Cloure file's full path.
   * @param {string} modulePath the Closure file's full path.
   * @return {GoogModuleData} cooked module data.
   */
  requireModuleByPath(modulePath) {
    var moduleData = this.path2Module.get(modulePath);
    if (moduleData === undefined) {
      this.path2Module.set(modulePath, new GoogModuleData(modulePath));
      moduleData = this.path2Module.get(modulePath);
    }

    if (!moduleData.cooked) {
      this.require_(moduleData);
    }

    return moduleData;
  }

  /** 
   * Get cooked module data from a provided namespace.
   * @param {string} namespace Closure namespace.
   * @return {GoogModuleData} cooked module data.
   */
  requireModuleByName(namespace) {
    const modulePath = this.namespace2Path.get(namespace);
    if (modulePath === undefined) {
      throw new Error(`Unknow namespace ${namespace}!!`);
    }

    return this.requireModuleByPath(modulePath);
  }

  require_(moduleData) {
    moduleData.cooked = true;

    // the parser's program hooks always trigged finally after all expressions
    // parsed, so if you want to find out the current node's ancestor and more,
    // you have to build an extra AST ahead the webpack parser start.
    moduleData.ast = astUtils.buildAcornTree(moduleData.path, {
      ecmaVersion: 2017,
      sourceType: 'module'
    });
    if (moduleData.ast === null || moduleData.ast === undefined) {
      throw new Error(`Acorn failed to parse "${moduleData.path}"!!`);
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

    // extract module data.
    walk.simple(moduleData.ast, {
      CallExpression: node => {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'goog' &&
          node.callee.property.type === 'Identifier'
        ) {
          switch (node.callee.property.name) {
            case 'require':
              // traditional goog.require only could be child of 'ExpressionStatement'
              // node, if the parent node is other types, that's a goog module. 
              //  in 'VariableDeclarator': var Bar = goog.require('Bar');
              //  in 'AssignmentExpression': Bar = goog.require('Bar'); 
              //  in 'CallExpression': foo(goog.require('Bar'));
              //  in 'ArrayExpression': var foo = [goog.require('Bar')];
              if (
                node.ancestor &&
                node.ancestor.type === 'ExpressionStatement' &&
                moduleData.isGoogModule === false
              ) {
                moduleData.isGoogModule = false;
              } else {
                moduleData.isGogModule = true;
              }
              moduleData.requires.add(node.arguments[0].value);
              break;
            case 'provide':
              // goog.privide not allowed in goog module.
              if (moduleData.isGoogModule === true) {
                throw new Error(`Unexpected "goog.provide" in goog mogule!!`);
              }
              moduleData.isGoogModule = false;
              moduleData.provides.add(node.arguments[0].value);
              this.namespace2Path.set(node.arguments[0].value, moduleData.path);
              break;
            case 'module':
            case 'declareModuleId':
              if (moduleData.isGoogModule === false) {
                throw new Error(`Do not use "goog.module" or "goog.declareModuleId" 
                with traditional "goog.require" and "goog.provide"!!`);
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