'use strict';

const pig = require('slim-pig');

const ModuleType = require('./ModuleType');
const PluginError = require('../errors/PluginError');
const { tap, tapMulti } = require('../utils/tap');

const BadRequire = require('../errors/BadRequire');
const DeprecateWarning = require('../errors/DeprecateWarning');
const InvalidParameterError = require('../errors/InvalidParameterError');
const MissingParameterError = require('../errors/MissingParameterError');
const MixedModuleTypeError = require('../errors/MixedModuleTypeError');
const ModifyImplicitNamespaceWarning = require('../errors/ModifyImplicitNamespaceWarning');
const ModifyRequiredNamespaceWarning = require('../errors/ModifyRequiredNamespaceWarning');
const MultiCallingError = require('../errors/MultiCallingError');
const NamespaceConflictError = require('../errors/NamespaceConflictError');
const NamespaceOutModuleError = require('../errors/NamespaceOutModuleError');
const UnexpectCallingError = require('../errors/UnexpectCallingError');

/** @typedef {import('../types').CallExpressionNode} CallExpressionNode */
/** @typedef {import('../types').ClosureModule} ClosureModule */
/** @typedef {import('../types').ClosureTree} ClosureTree */
/** @typedef {import('../types').ClosureCommentAnnotation} ClosureCommentAnnotation */
/** @typedef {import('../types').CommentNode} CommentNode */
/** @typedef {import('../types').DependencyParam} DependencyParam */
/** @typedef {import('../types').DefineParam} DefineParam */
/** @typedef {import('../types').Environment} Environment */
/** @typedef {import('../types').ProvideInfo} ProvideInfo */
/** @typedef {import('../types').ExpressionNode} ExpressionNode */
/** @typedef {import('../types').RequireInfo} RequireInfo */
/** @typedef {import('../types').StatementNode} StatementNode */
/** @typedef {import('../types').WPJavascriptParser} WPJavascriptParser */


const isDirectiveStatement = statement =>
  statement.type === 'ExpressionStatement'
  && statement.expression && statement.expression.type === 'Literal'
  && typeof statement.directive === 'string';

const isFreeVariable = (parser, varName) => {
  return parser.getFreeInfoFromVariable(varName) !== undefined;
}

/**
 * @param {ClosureModule} module
 * @param {ModuleType} type
 * @returns {void}
 */
const setModuleType = (module, type) => {
  if (module.type === type) return;
  if (module.type !== ModuleType.SCRIPT) {
    throw new MixedModuleTypeError(module.request, module.type, type);
  }
  module.type = type;
}

const PLUGIN_NAME = 'GoogleClosureLibraryWebpackPlugin|ClosureModuleParserPlugin';
const COMMON_STAGE = -2;
const DETECT_BASE_STAGE = -1;
const namespaceTag = Symbol(`${PLUGIN_NAME}|namespaceTag`);
const googTag = Symbol(`${PLUGIN_NAME}|googTag`);

/**
 * ClosureTree plugin to parse ClosureModule.
 */
class ClosureModuleParserPlugin {
  /**
   * @param {object} options
   * @param {ClosureTree} options.tree
   * @param {Environment} options.env
   * @param {boolean} [options.hideLibraryWarnings]
   */
  constructor({ tree, env, hideLibraryWarnings = true }) {
    /** @type {ClosureTree} */
    this.tree = tree;
    /** @type {Environment} */
    this.env = env;

    this.shouldShowWarning = request =>
      !this.tree.isLibraryModule(request) || !hideLibraryWarnings;
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _common(parser) {
    const options = { name: PLUGIN_NAME, state: COMMON_STAGE };
    tap(options, parser.hooks.program, null, ast => {
      parser.state.closure.ast = ast;
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _detectBaseFile(parser) {
    const hooks = parser.hooks;

    // Detect base.js file.
    const options = { name: PLUGIN_NAME, stage: DETECT_BASE_STAGE };
    tap(options, hooks.program, null, () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      // By path.
      if (pig.fs.isSameDirectory(module.request, module.tree.basefile)) {
        module.isbase = true;

        // Manaually add goog provide information.
        module.addProvide('goog', {
          namespace: 'goog',
          expr: undefined,
          statement: undefined,
          id: 'goog'
        });

        // Tag goog API.
        // !!Only need tag in base.js file, help trigger the assignMemberChain 
        // of goog and calling of goog.define.
        parser.tagVariable('goog', googTag, 'goog');
      }
    });

    // COMPILED force to true, mock goog.define.
    tap(PLUGIN_NAME, hooks.declarator, null, (declarator, statement) => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (!module.isbase) { return; }

      if (declarator.id.name === 'COMPILED') {
        module.defines.set('COMPILED', {
          expr: declarator.init,
          name: 'COMPILED',
          value: 'true',
          valueType: 'boolean'
        });
      }
    });
    // Replace goog.global with options.output.globalObject, mock goog.define.
    tap(PLUGIN_NAME, hooks.assignMemberChain, 'goog', (expr, members) => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (!module.isbase) { return; }

      /** @type {string} */
      const exprName = ['goog'].concat(members).join('.');
      if (exprName === 'goog.global') {
        if (typeof this.env.globalObject === 'string') {
          module.defines.set('goog.global', {
            expr: expr.right,
            name: 'goog.global',
            value: this.env.globalObject,
            valueType: 'expression'
          });
        }
      }
    });
    // goog.DEBUG force to false.
    tap(PLUGIN_NAME, hooks.finish, null, () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (!module.isbase) { return; }

      if (module.defines.has('goog.DEBUG')) {
        const define = module.defines.get('goog.DEBUG');
        if (define.valueType !== 'boolean') {
          throw new Error(`Expect the defaultValue of goog.DEBUG has a boolean type, but get ${define.valueType}.`);
        }
        define.value = 'false';
      }
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _detectCommonJS(parser) {
    const hooks = parser.hooks;

    // Detect file extension.
    tap(PLUGIN_NAME, hooks.program, null, () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.COMMONJS) { return; }

      if (module.request.endsWith('.cjs')) {
        setModuleType(module, ModuleType.COMMONJS);
      }
    });

    // Detect typeof module.
    tap(PLUGIN_NAME, hooks.typeof, 'module', () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.COMMONJS) { return; }

      setModuleType(module, ModuleType.COMMONJS);
    });
    // Detect expression of require.main, require.cache, module.loaded and module.id.
    tap(PLUGIN_NAME, hooks.expression, [
      'require.main', 'require.cache', 'module.loaded', 'module.id'
    ], () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.COMMONJS) { return; }

      setModuleType(module, ModuleType.COMMONJS);
    });

    // Detect calling of require.
    // !!`new require("./a");` is a semantic error, but Webpack will fix it.
    tapMulti(PLUGIN_NAME, [hooks.call, hooks.new], [
      'require', 'module.require'
    ], expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.COMMONJS) { return; }

      if (expr.arguments.length !== 1) { return; }
      setModuleType(module, ModuleType.COMMONJS);
    });

    // Detect calling of require.resolve.
    tap(PLUGIN_NAME, hooks.call, [
      'require.resolve', 'module.require.resolve',
      'require.resolveWeak', 'module.require.resolveWeak',
    ], expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.COMMONJS) { return; }

      if (expr.arguments.length !== 1) { return; }
      setModuleType(module, ModuleType.COMMONJS);
    });

    // Detect Webpack HMR in CommonJS module.
    tap(PLUGIN_NAME, hooks.expression, 'module.hot', () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.COMMONJS) { return; }

      setModuleType(module, ModuleType.COMMONJS);
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _detectES(parser) {
    // Detect file extension.
    tap(PLUGIN_NAME, parser.hooks.program, null, () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.ES) { return; }

      if (module.request.endsWith('.mjs')) {
        setModuleType(module, ModuleType.ES);
      }
    });

    // Detect import and export.
    tap(PLUGIN_NAME, parser.hooks.program, null, ast => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.ES) { return; }

      if (ast.body.some(statement =>
        statement.type === "ImportDeclaration"
        || statement.type === "ExportDefaultDeclaration"
        || statement.type === "ExportNamedDeclaration"
        || statement.type === "ExportAllDeclaration"
      )) {
        setModuleType(module, ModuleType.ES);
      }
    });

    // Detect Webpack HMR in ES module.
    tap(PLUGIN_NAME, parser.hooks.expression, 'import.meta.webpackHot', () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.type === ModuleType.ES) { return; }

      setModuleType(module, ModuleType.ES);
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _detectUseClosure(parser) {
    // Detect use Closure.
    tap(PLUGIN_NAME, parser.hooks.expression, 'goog', () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase || module.requires.has('goog')) { return; }

      // If goog is a free variable, should use Closure.
      if (isFreeVariable(parser, 'goog')) {
        /** @type {RequireInfo} */
        const info = {
          namespace: 'goog',
          confirmed: true,
          position: 0 // defautls to 0, the head line position.
        };
        // Import goog statement should behind all directives and ahead of all 
        // other statements.
        for (const statement of parser.state.closure.ast.body) {
          if (!isDirectiveStatement(statement)) {
            info.position = statement.range[0];
            break;
          }
        }
        module.addRequire('goog', info);
      }
    });
  }

  // TODO: parse annotations.
  // /**
  //  * @private
  //  * @param {WPJavascriptParser} parser
  //  * @returns {void}
  //  */
  // _parseAnnotation(parser) {
  //   // const parseAnnotations = comments => {
  //   //   // Regex for a JSDoc annotation with an "@name" and an optional brace-delimited "{value}"".
  //   //   // The "@" should not match the middle of a word.
  //   //   const REG =
  //   //     /(?:[^a-zA-Z0-9_$]|^)(@[a-zA-Z]+)(?:\s*\{\s*([^}\t\n\v\f\r ]+)\s*\})?/gm;

  //   //   const annotations = [];
  //   //   for (const comment of comments) {
  //   //     let matches = undefined;
  //   //     while ((matches = REG.exec(comment.value)) !== null) {
  //   //       if (matches.index === REG.lastIndex) {
  //   //         REG.lastIndex++;
  //   //         continue;
  //   //       }
  //   //       if (matches.length === 3) {
  //   //         annotations.push({
  //   //           name: matches[1],
  //   //           value: matches[2],
  //   //           loc: comment.loc
  //   //         });
  //   //       }
  //   //     }
  //   //   }
  //   //   return annotations;
  //   // }
  // }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _parseDefine(parser) {
    const hooks = parser.hooks;

    // Parse goog.define.
    tap(PLUGIN_NAME, hooks.call, 'goog.define', expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;

      const nameArg = expr.arguments[0];
      // Error if name prameter missing.
      if (nameArg === undefined) {
        throw new MissingParameterError(module.request, expr.loc, 'name');
      }
      // Error if name not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg.isString()) {
        throw new InvalidParameterError(
          module.request, expr.loc,
          'name', null,
          'its must be string'
        );
      }

      /** @type {DefineParam} */
      const define = {
        expr,
        name: evalNameArg.string,
        value: undefined,
        valueType: undefined,
      };
      const valueArg = expr.arguments[1];
      // Error if defaultValue parameter missing.
      if (valueArg === undefined) {
        throw new MissingParameterError(module.request, expr.loc, 'defaultValue ');
      }
      const evalValueArg = parser.evaluateExpression(valueArg);
      if (evalValueArg.isString()) {
        define.value = `"${evalValueArg.string}"`;
        define.valueType = 'string';
      } else if (evalValueArg.isBoolean()) {
        define.value = evalValueArg.bool.toString();
        define.valueType = 'boolean';
      } else if (evalValueArg.isNumber()) {
        define.value = evalValueArg.number.toString();
        define.valueType = 'number';
      } else if (evalValueArg.isRegExp()) {
        define.value = evalValueArg.regExp.toString()
        define.valueType = 'RegExp';
      } else if (valueArg.type.endsWith('FunctionExpression')) {
        define.value = module.source.slice(valueArg.range[0], valueArg.range[1]);
        define.valueType = 'function';
      } else if (valueArg.type.endsWith('Expression')) {
        define.value = module.source.slice(valueArg.range[0], valueArg.range[1]);
        define.valueType = 'expression';
      } else {
        throw new InvalidParameterError(
          module.request, expr.loc,
          'defaultValue', null,
          'its must be string, boolean, number, RegExp or function'
        );
      }
      module.defines.set(define.name, define);
    });

    // Apply defs option.
    tap(PLUGIN_NAME, hooks.finish, null, () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;

      for (const [name, define] of module.defines.entries()) {
        // Skip below names.
        if (['COMPILED', 'goog.DEBUG', 'goog.global'].includes(name)) {
          continue;
        }

        // If current name mentioned in defs option, apply it.
        if (this.env.defs.has(name)) {
          define.value = this.env.defs.get(name);
        }
      }
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _parseDeps(parser) {
    const hooks = parser.hooks;

    // Detect dependencies file.
    tap(PLUGIN_NAME, hooks.program, null, ast => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      const tree = module.tree;
      if (module.isbase || module.isdeps) { return; }

      // Detect by path, in Closure library only has one deps file.
      if (tree.isLibraryModule(module.request)) {
        if (pig.fs.isSameDirectory(module.request, tree.depsfile)) {
          module.isdeps = true;
        }
        return;
      }

      let hasAddDependency = false;
      for (const statement of ast.body) {
        // Deps file should only has directive and goog.addDependency statement.
        if ((statement.type === 'ExpressionStatement'
          && statement.expression && statement.expression.type === 'CallExpression'
          && statement.expression.callee && statement.expression.callee.type === 'MemberExpression'
          && statement.expression.callee.object
          && statement.expression.callee.object.type === 'Identifier'
          && statement.expression.callee.object.name === 'goog'
          && statement.expression.callee.property
          && statement.expression.callee.property.type === 'Identifier'
          && statement.expression.callee.property.name === 'addDependency'
        )) {
          hasAddDependency = true;
        } else if (!isDirectiveStatement(statement)) {
          module.isdeps = false;
          return;
        }
      }
      module.isdeps = hasAddDependency;
    });

    // Parse goog.addDependency.
    tap(PLUGIN_NAME, hooks.call, 'goog.addDependency', expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      const tree = module.tree;
      if (module.isbase) { return; }

      if (module.isdeps === false) {
        throw new UnexpectCallingError(
          module.request,
          expr.loc,
          'goog.addDependency',
          'outside dependencies file'
        );
      }

      const currentStatement = parser.statementPath[parser.statementPath.length - 1];
      /** @type {DependencyParam} */
      const param = {
        text: module.source.slice(currentStatement.range[0], currentStatement.range[1]),
        relPath: undefined,
        provides: [],
        requires: [],
        flags: {}
      };

      // Parse request.
      const relPathArg = expr.arguments[0];
      // Error if relPath parameter missing.
      if (expr.arguments[0] === undefined) {
        throw new MissingParameterError(module.request, expr.loc, 'relPath');
      }
      const evalRelPathArg = parser.evaluateExpression(relPathArg);
      // Error if relPath not string.
      if (!evalRelPathArg.isString()) {
        throw new InvalidParameterError(
          module.request, relPathArg.loc,
          'relPath', null,
          'its must be a relative path from base.js'
        );
      }
      param.relPath = evalRelPathArg.string;

      // Parse provides.
      const providesArg = expr.arguments[1];
      if (providesArg) {
        // Error if provides parameter not array.
        if (providesArg.type !== 'ArrayExpression') {
          throw new InvalidParameterError(
            module.request, providesArg.loc,
            'provides', null,
            'its must be a string array'
          );
        }

        for (const name of providesArg.elements) {
          // Error if provides element not string.
          const evalName = parser.evaluateExpression(name);
          if (!evalName.isString()) {
            throw new InvalidParameterError(
              module.request, name.loc,
              'provides', null,
              'its must be a string array'
            );
          }
          param.provides.push(evalName.string);
        }
      }

      // Parse requires.
      const requiresArg = expr.arguments[2];
      if (requiresArg) {
        // Error if requires parameter not array.
        if (requiresArg.type !== 'ArrayExpression') {
          throw new InvalidParameterError(
            module.request, requiresArg.loc,
            'requires', null,
            'its must be a string array'
          );
        }

        for (const name of requiresArg.elements) {
          // Error if requires element not string.
          const evalName = parser.evaluateExpression(name);
          if (!evalName.isString()) {
            throw new InvalidParameterError(
              module.request, name.loc,
              'requires', null,
              'its must be a string array'
            );
          }
          param.requires.push(evalName.string);
        }
      }

      // Parse load flags.
      const flagsArg = expr.arguments[3];
      if (flagsArg) {
        if (flagsArg.type === 'Literal') {
          if (flagsArg.value !== true) {
            throw new InvalidParameterError(
              module.request, flagsArg.loc,
              'opt_loadFlags'
            );
          }
          param.flags.goog = 'module';
        } else if (flagsArg.type === 'ObjectExpression') {
          for (const prop of flagsArg.properties) {
            /** @type {string} */
            let key = undefined;
            const evalKey = parser.evaluateExpression(prop.key);
            if (evalKey.isIdentifier()) {
              key = prop.key.name;
            } else if (evalKey.isString()) {
              key = evalKey.string;
            } else {
              throw new InvalidParameterError(
                module.request, prop.key.loc,
                'opt_loadFlags'
              );
            }
            if (key !== 'module' && key !== 'lang') {
              throw new InvalidParameterError(
                module.request, prop.key.loc,
                'opt_loadFlags',
                `unknow property ${key}`
              );
            }

            const evalValue = parser.evaluateExpression(prop.value);
            if (!evalValue.isString()) {
              throw new InvalidParameterError(
                module.request, prop.key.loc,
                'opt_loadFlags', key
              );
            }
            Object.defineProperty(param.flags, key, {
              value: evalValue.string.toLowerCase()
            });
          }
        } else {
          throw new InvalidParameterError(
            module.request, flagsArg.loc,
            'opt_loadFlags'
          );
        }
      }

      // In some versions of the deps.js file, provides parameter in this line
      // "goog.addDependency('base.js', [], []);" is empty.
      if (param.relPath === 'base.js' && !param.provides.includes('goog')) {
        param.provides.push('goog');
      }

      tree.loadModule(param);
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _parseModule(parser) {
    const hooks = parser.hooks;

    const createHandler = funcname => expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      // Error if multi calling.
      if (module.provides.size !== 0) {
        throw new MultiCallingError(module.request, funcname);
      }
      // Error if outside ES and CommonJS module.
      if (module.type === ModuleType.PROVIDE || module.type === ModuleType.GOOG) {
        throw new UnexpectCallingError(
          module.request, expr.loc,
          funcname,
          'should not use it outside ES and CommonJS module'
        );
      }
      // Error if namespace parameter missing.
      const nameArg = expr.arguments[0];
      if (nameArg === undefined) {
        throw new MissingParameterError(module.request, expr.loc, 'namespace');
      }
      // Error if namespace parameter not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg.isString()) {
        throw new InvalidParameterError(
          module.request, nameArg.loc,
          'namespace', null,
          'its should be dot-separated sequence of a-z, A-Z, 0-9, _ and $'
        );
      }
      // Warning if calling of deprecated goog.module.declareNamespace.
      if (funcname === 'goog.module.declareNamespace') {
        if (this.shouldShowWarning(module.request)) {
          const warning = new DeprecateWarning(
            module.request, expr.loc,
            funcname, 'goog.declareModuleId'
          );
          module.warnings.push(warning);
        }
      }

      const namespace = evalNameArg.string;
      const currentStatement = parser.statementPath[parser.statementPath.length - 1];
      module.addProvide(namespace, {
        namespace,
        expr,
        statement: /** @type {any} */(currentStatement)
      });
    }
    // Parse goog.declareModuleId.
    tap(PLUGIN_NAME, hooks.call, 'goog.declareModuleId',
      createHandler('goog.declareModuleId')
    );
    // Parse goog.module.declareNamespace.
    tap(PLUGIN_NAME, hooks.call, 'goog.module.declareNamespace',
      createHandler('goog.module.declareNamespace')
    );

    // Parse goog.module.
    tap(PLUGIN_NAME, hooks.call, 'goog.module', expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      // Error if multi calling of goog.module.
      if (module.type === ModuleType.GOOG) {
        throw new MultiCallingError(module.request, 'goog.module');
      }
      // Error if goog.module not first statement.
      const currentStatement = parser.statementPath[parser.statementPath.length - 1];
      for (const statement of parser.state.closure.ast.body) {
        if (statement === currentStatement) { break; }
        if (!isDirectiveStatement(statement)) {
          throw new PluginError(
            `goog.module must be first statement at file ${module.request}.`
          );
        }
      }
      // Error if name parameter missing.
      const nameArg = expr.arguments[0];
      if (nameArg === undefined) {
        throw new MissingParameterError(module.request, expr.loc, 'name');
      }
      // Error if name parameter not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg.isString()) {
        throw new InvalidParameterError(module.request, nameArg.loc, 'name');
      }

      /** @type {string} */
      const namespace = evalNameArg.string;
      const namespaceRoot = namespace.split('.')[0];

      // If namespace root not local variable, tag this provided namespace root 
      // for usages.
      if (isFreeVariable(parser, namespaceRoot)) {
        if (parser.getTagData(namespaceRoot, namespaceTag) === undefined) {
          parser.tagVariable(namespaceRoot, namespaceTag, namespaceRoot);
        }
      }

      setModuleType(module, ModuleType.GOOG);
      module.addProvide(namespace, {
        namespace,
        expr,
        statement: /** @type {any} */(currentStatement),
        id: 'exports'
      });
    });

    // Parse goog.module.declareLegacyNamespace.
    tap(PLUGIN_NAME, hooks.call, 'goog.module.declareLegacyNamespace',
      expr => {
        /** @type {ClosureModule} */
        const module = parser.state.closure.module;
        if (module.isbase) { return; }

        // Error if calling outside GOOG module.
        if (module.type !== ModuleType.GOOG) {
          throw new UnexpectCallingError(
            module.request, expr.loc,
            'goog.module.declareLegacyNamespace',
            'outside GOOG module'
          );
        }

        const namespace = Array.from(module.provides.keys())[0];
        const namespaceRoot = namespace.split('.')[0];
        // In legacy GOOG module, error if provided namespace root conflict with 
        // local variable declaration.
        if (!isFreeVariable(parser, namespaceRoot)) {
          const loc = module.provides.get(namespace).expr.loc;
          throw new NamespaceConflictError(
            module.request, loc,
            namespace, 'local variable declaration',
            'the provided namespace is reserved in legacy GOOG module'
          );
        }

        module.legacy = /** @type {any} */(
          parser.statementPath[parser.statementPath.length - 1]
        );
      }
    );

    // In GOOG module, record declaration of the exported local variable.
    tap(PLUGIN_NAME, hooks.declarator, null, (declarator, statement) => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      // Stop if not GOOG module.
      if (module.type !== ModuleType.GOOG) { return; }

      const info = Array.from(module.provides.values())[0];
      if (declarator.id.name === info.id) {
        info.declaration = statement;
      }
    })
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _parseProvides(parser) {
    const hooks = parser.hooks;

    // Parse goog.provide.
    tap(PLUGIN_NAME, hooks.call, 'goog.provide', expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      // Error if name parameter missing.
      const nameArg = expr.arguments[0];
      if (nameArg === undefined) {
        throw new MissingParameterError(module.request, expr.loc, 'name');
      }
      // Error if name parameter not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg.isString()) {
        throw new InvalidParameterError(module.request, expr.loc, 'name');
      }

      /** @type {string} */
      const namespace = evalNameArg.string;
      const namespaceRoot = namespace.split('.')[0];
      // Error if provided namespace conflict with local variable declaration. 
      if (!isFreeVariable(parser, namespaceRoot)) {
        throw new NamespaceConflictError(
          module.request, nameArg.loc,
          namespace, 'local variable declaration',
          `you can direct use the globally accessible object or the variable should use another name`
        );
      }

      // Tag this provided namespace root to record usages.
      if (parser.getTagData(namespaceRoot, namespaceTag) === undefined) {
        parser.tagVariable(namespaceRoot, namespaceTag, namespaceRoot);
      }

      if (this.shouldShowWarning(module.request)) {
        const warning = new DeprecateWarning(
          module.request, expr.loc,
          'goog.provide', 'goog.module'
        );
        module.warnings.push(warning);
      }

      setModuleType(module, ModuleType.PROVIDE);
      const currentStatement = parser.statementPath[parser.statementPath.length - 1];
      module.addProvide(namespace, {
        namespace,
        expr,
        statement: /** @type {any} */(currentStatement)
      });
    });

    // Parse implicit namespaces of provide information, only for PROVIDE and
    // legacy GOOG module.
    tap(PLUGIN_NAME, hooks.finish, null, () => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      if (module.type === ModuleType.PROVIDE || module.legacy) {
        const travelNamespaceToRoot = (namespace, callback) => {
          const parts = namespace.split('.');
          while (parts.length > 0) {
            const op = callback(parts.join('.'));
            if (op === false) { break; }
            parts.pop();
          }
        }

        // Store all required and implicit namespaces.
        const allrequired = new Set();
        for (const namespace of module.requires.keys()) {
          travelNamespaceToRoot(namespace, current => allrequired.add(current));
        }
        // Store all implicit namespaces.
        const allImplicities = new Set();

        Array.from(module.provides.values())
          // Sort provided namespaces by position.
          .sort((a, b) => {
            const apos = a.expr ? a.expr.range[1] : 0;
            const bpos = b.expr ? b.expr.range[1] : 0;
            return apos - bpos;
          })
          // Fill the implicit namespaces.
          .forEach(info => {
            if (info.implicities === undefined) {
              info.implicities = [];
            }
            travelNamespaceToRoot(info.namespace, current => {
              // If current namespace has required, stop it.
              if (allrequired.has(current)) { return false; }
              // If current namespace not contruct and not provided.
              if (!allImplicities.has(current) && !module.provides.has(current)) {
                info.implicities.push(current);
                allImplicities.add(current);
              }
            });
            info.implicities = info.implicities.reverse();
          });
      }
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _parseRequires(parser) {
    const hooks = parser.hooks;

    // Parse goog.require and require information.
    tap(PLUGIN_NAME, hooks.call, 'goog.require', expr => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      const nameArg = expr.arguments[0];
      // Error if namespace parameter missing.
      if (nameArg === undefined) {
        throw new MissingParameterError(module.request, expr.loc, 'namespace');
      }
      const evalNameArg = parser.evaluateExpression(nameArg);
      // Error if namespace parameter not string.
      if (!evalNameArg.isString()) {
        throw new InvalidParameterError(module.request, expr.loc, 'namespace');
      }

      const namespace = evalNameArg.string;
      const namespaceRoot = namespace.split('.')[0];
      // Error if manually require Closure library namespace goog.
      if (namespace === 'goog') {
        throw new PluginError(`Should not require Closure library namespace goog manually at file ${module.request}.`);
      }
      // In PROVIDE and legacy GOOG module, error if required namespace root 
      // conflict with local variable declaration.
      if (module.type === ModuleType.PROVIDE || module.legacy) {
        // If the required namespace root not a free variable.
        if (!isFreeVariable(parser, namespaceRoot)) {
          throw new NamespaceConflictError(
            module.request, nameArg.loc,
            namespace, 'local variable declaration',
            'the required namespace is reserved in PROVIDE and legacy GOOG module,' +
            ' you can direct use the globally accessible object or the variable should use another name'
          );
        }

        // Tag required namespace root to record usages.
        if (parser.getTagData(namespaceRoot, namespaceTag) === undefined) {
          parser.tagVariable(namespaceRoot, namespaceTag, namespaceRoot);
        }
      } else {
        // If namespace root not local variable, tag this required namespace root 
        // for usages.
        if (isFreeVariable(parser, namespaceRoot)) {
          if (parser.getTagData(namespaceRoot, namespaceTag) === undefined) {
            parser.tagVariable(namespaceRoot, namespaceTag, namespaceRoot);
          }
        }
      }



      const currentStatement = parser.statementPath[parser.statementPath.length - 1];
      /** @type {RequireInfo} */
      const info = {
        namespace,
        confirmed: true,
        position: currentStatement.range[0],
        expr,
        statement: /** @type {any} */(currentStatement),
        used: true
      };
      if (currentStatement === expr
        || (currentStatement.type === 'ExpressionStatement'
          && currentStatement.expression === expr)
      ) {
        info.used = false;
      } else {
        // In PROVIDE module, use goog.require expression result, should warning.
        if (module.type === ModuleType.PROVIDE) {
          if (this.shouldShowWarning(module.request)) {
            const warning = new BadRequire(
              module.request, expr.loc,
              `goog.require always return null in PROVIDE module,` +
              ` you can direct use the globally accessible object`
            );
            module.warnings.push(warning);
          }
        }
      }
      module.addRequire(namespace, info);
    });

    // Parse memberChain and callMemberChain of goog.require.
    // Something like goog.require("a").val and goog.require("a").func().
    tapMulti(PLUGIN_NAME, [
      hooks.memberChainOfCallMemberChain,
      hooks.callMemberChainOfCallMemberChain
    ], 'goog', (expr, calleeMembers, callExpr, members) => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;
      if (module.isbase) { return; }

      const calleeName = ['goog'].concat(calleeMembers).join('.');
      // Stop if callee object not goog.require.
      if (calleeName !== 'goog.require') { return; }

      // In PROVIDE module, error if use memberChain and callMemberChain of goog.require.
      // Only check current module type, the required module type is still unknow now.
      if (module.type === ModuleType.PROVIDE) {
        throw new BadRequire(
          module.request, expr.loc,
          `goog.require always return null in PROVIDE module,` +
          ` you can direct use the globally accessible object`
        );
      }
    });
  }

  /**
   * @private
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  _parseNamespaceUsage(parser) {
    const hooks = parser.hooks;

    // Warning if modify required namespace;
    // Warning if modify implicit namespace;
    tapMulti(PLUGIN_NAME, [
      hooks.assign, hooks.assignMemberChain
    ], namespaceTag, (expr, members) => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;

      /** @type {string} */
      const namespaceRoot = parser.currentTagData;
      const namespace = [namespaceRoot].concat(members || []).join('.');
      if (this.shouldShowWarning(module.request)) {
        switch (module.getNamespaceInfo(namespace).type) {
          case 'require':
            // Warning if modify required namespace.
            module.warnings.push(new ModifyRequiredNamespaceWarning(
              module.request, expr.loc, namespace
            ));
            break;
          case 'implicit':
            // Warning if modify implicit namespace.
            module.warnings.push(new ModifyImplicitNamespaceWarning(
              module.request, expr.loc, namespace
            ));
            break;
        }
      }
    });

    // Record namespace usages in PROVIDE and legacy GOOG module, something like
    // a, a.b and a.b().
    tapMulti(PLUGIN_NAME, [
      hooks.expression, hooks.expressionMemberChain, hooks.callMemberChain
    ], namespaceTag, (expr, members) => {
      /** @type {ClosureModule} */
      const module = parser.state.closure.module;

      // Stop if Closure library module.
      if (this.tree.isLibraryModule(module.request)) { return; }
      /** @type {string} */
      const namespaceRoot = parser.currentTagData;
      // Stop if namespace start with goog.
      if (namespaceRoot === 'goog') { return; }
      const exprName = [namespaceRoot].concat(members || []).join('.');
      // Get current used namespace.
      const namespace = module.getNamespaceInfo(exprName).owner;
      if (namespace === undefined) { return; }
      if (module.type === ModuleType.PROVIDE || module.legacy) {
        // Record this usage.
        let usages = module.namespaceUsages.get(namespace);
        if (usages === undefined) {
          module.namespaceUsages.set(namespace, usages = []);
        }
        usages.push(expr);
      } else {
        // Error if using namespace outside PROVIDE and legacy GOOG module.
        throw new NamespaceOutModuleError(module.request, expr.loc, namespace);
      }

      if (members !== undefined) {
        // Return true to stop expressionMemberChain and not trigger expression 
        // for this namespace root anymore.
        return true;
      }
    });
  }

  /**
   * @param {WPJavascriptParser} parser
   * @returns {void}
   */
  apply(parser) {
    this._common(parser);
    this._detectBaseFile(parser);
    this._detectCommonJS(parser);
    this._detectES(parser);
    this._detectUseClosure(parser);
    // this._parseAnnotation(parser);
    this._parseDefine(parser);
    this._parseDeps(parser);
    this._parseModule(parser);
    this._parseProvides(parser);
    this._parseRequires(parser);
    this._parseNamespaceUsage(parser);
  }
}

module.exports = ClosureModuleParserPlugin;
