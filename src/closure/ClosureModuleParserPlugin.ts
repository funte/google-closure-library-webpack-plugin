import pig from 'slim-pig';
import webpack from 'webpack';
import BasicEvaluatedExpression = require('webpack/lib/javascript/BasicEvaluatedExpression');

import { DefineParam, DependencyParam, ModuleType, RequireInfo } from './ClosureModule';
import { PluginError } from '../errors/PluginError';
import { tap, tapMulti } from '../utils/tap';

import { BadRequire } from '../errors/BadRequire';
import { DeprecateWarning } from '../errors/DeprecateWarning';
import { GoogConstTrans } from '../transformation/transform/GoogConstTrans';
import { InvalidParameterError } from '../errors/InvalidParameterError';
import { MissingParameterError } from '../errors/MissingParameterError';
import { MixedModuleTypeError } from '../errors/MixedModuleTypeError';
import { ModifyImplicitNamespaceWarning } from '../errors/ModifyImplicitNamespaceWarning';
import { ModifyRequiredNamespaceWarning } from '../errors/ModifyRequiredNamespaceWarning';
import { MultiCallingError } from '../errors/MultiCallingError';
import { NamespaceConflictError } from '../errors/NamespaceConflictError';
import { NamespaceOutModuleError } from '../errors/NamespaceOutModuleError';
import { UnexpectCallingError } from '../errors/UnexpectCallingError';

import type { ClosureModule } from './ClosureModule';
import type { ClosureTree } from './ClosureTree';
import type { Environment } from '../Environment';
import type {
  Statement as StatementNode,
  Directive as DirectiveNode
} from 'estree';
import type { DefineValueType } from '../Plugin';

const isDirectiveStatement = (statement: DirectiveNode | any): boolean =>
  statement.type === 'ExpressionStatement'
  && statement.expression && statement.expression.type === 'Literal'
  && typeof statement.directive === 'string';

const isFreeVariable = (
  parser: webpack.javascript.JavascriptParser, varName: string
): boolean => {
  return !!parser.getFreeInfoFromVariable(varName);
};

const setModuleType = (module: ClosureModule, type: ModuleType): void => {
  if (module.type === type) { return; }
  if (module.type !== ModuleType.SCRIPT) {
    throw new MixedModuleTypeError({
      file: module.request,
      type1: module.type,
      type2: type
    });
  }
  module.type = type;
};

const PLUGIN_NAME = 'GoogleClosureLibraryWebpackPlugin|ClosureModuleParserPlugin';

const COMMON_STAGE = -2;
const DETECT_BASE_STAGE = -1;

const namespaceTag = Symbol(`${PLUGIN_NAME}|namespaceTag`);
const googTag = Symbol(`${PLUGIN_NAME}|googTag`);
const constantTag = Symbol(`${PLUGIN_NAME}|constantTag`);

/** Plugin to parse Closure module. */
export class ClosureModuleParserPlugin {
  private shouldShowWarning: (request: string | ClosureModule) => boolean;

  constructor(
    public readonly tree: ClosureTree,
    public readonly env: Environment
  ) {
    if (this.env.warningLevel === 'show') {
      this.shouldShowWarning = () => true;
    } else if (this.env.warningLevel === 'hide') {
      this.shouldShowWarning = () => false;
    } else if (this.env.warningLevel === 'hideUser') {
      this.shouldShowWarning = arg => this.tree.isLibraryModule(arg);
    } else {
      // Defaults to "hideLib".
      this.shouldShowWarning = arg => !this.tree.isLibraryModule(arg);
    }
  }

  private common(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    const options = { name: PLUGIN_NAME, state: COMMON_STAGE };
    tap(options, parser.hooks.program, null, ast => {
      // Error if closure state undefined.
      if (!parser.state.closure) {
        throw new PluginError(`Undefined closure state.`);
      }
      const module = parser.state.closure.module as ClosureModule;
      // Error if current Closure module undefined.
      if (!module) {
        throw new PluginError(`Undefined Closure module in clousre state.`);
      }
      const tree = module.tree as ClosureTree;
      // Error if the tree undefined.
      if (!tree) {
        throw new PluginError(`Undefined tree of current Closure module ${module.request}.`);
      }

      // Tag all constants.
      for (const [name, value] of this.env.constants.entries()) {
        if (parser.getTagData(name, constantTag) === undefined) {
          parser.tagVariable(name, constantTag, { name, value });
        }
      }

      parser.state.closure.ast = ast;
    });

    // Replace freedom constants, e.g. the COMPILED in "if (!COMPILED) { }"
    tap(PLUGIN_NAME, hooks.expression, constantTag, expr => {
      const module = parser.state.closure.module as ClosureModule;
      const { name, value } = parser.currentTagData as { name: string, value: DefineValueType };
      const trans = new GoogConstTrans(
        module,
        [expr.range[0], expr.range[1] - 1],
        `/* ${name} */${JSON.stringify(value)}`
      );
      module.trans.push(trans);
      // Return true to stop parse its members.
      return true;
    });
    // Replace constants in the goog.define.
    tap(PLUGIN_NAME, hooks.evaluateIdentifier, constantTag, expr => {
      const { value } = parser.currentTagData as { name: string, value: DefineValueType };
      if (typeof value === 'string') {
        return new BasicEvaluatedExpression().setString(value);
      } else if (typeof value === 'boolean') {
        return new BasicEvaluatedExpression().setBoolean(value);
      } else if (typeof value === 'number') {
        return new BasicEvaluatedExpression().setNumber(value);
      }
    });
  }

  private detectBaseFile(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    // Detect base.js file.
    const options = { name: PLUGIN_NAME, stage: DETECT_BASE_STAGE };
    tap(options, hooks.program, null, () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase || !module.tree?.basefile) { return; }

      // By path.
      if (pig.fs.isSameDirectory(module.request, module.tree.basefile)) {
        module.isbase = true;

        // Manaually add goog provide information.
        module.addProvide('goog', {
          fullname: 'goog',
          id: 'goog'
        });

        // Tag goog API.
        // !!Only tag in base.js file, to trigger the assignMemberChain 
        // of goog and calling of goog.define.
        parser.tagVariable('goog', googTag, 'goog');
      }
    });

    // Remove the COMPILED declaration.
    tap(PLUGIN_NAME, hooks.declarator, null, (declarator, statement) => {
      const module = parser.state.closure.module as ClosureModule;
      if (!module.isbase) { return; }

      if (declarator.id.name === 'COMPILED') {
        // Error if current statement node range property undefined.
        const currentStatement = parser.statementPath[parser.statementPath.length - 1];
        if (!currentStatement.range
          || typeof currentStatement.range[0] !== 'number'
          || typeof currentStatement.range[1] !== 'number'
        ) {
          throw new PluginError(`Undefined statement range property at file ${module.request}.`);
        }
        // Add a GoogConstTrans to remove the declaration.
        module.trans.push(new GoogConstTrans(module, currentStatement.range));
      }
    });

    // Replace goog.global with options.output.globalObject.
    tap(PLUGIN_NAME, hooks.assignMemberChain, 'goog', (expr, members) => {
      const module = parser.state.closure.module as ClosureModule;
      if (!module.isbase) { return; }

      const exprName = ['goog'].concat(members).join('.');
      if (exprName === 'goog.global' && typeof this.env.globalObject === 'string') {
        const trans = new GoogConstTrans(module, expr.right.range, this.env.globalObject);
        module.trans.push(trans);
      }
    });
  }

  private detectCommonJS(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    // Detect file extension.
    tap(PLUGIN_NAME, hooks.program, null, () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.COMMONJS) { return; }
      if (module.request.endsWith('.cjs')) {
        setModuleType(module, ModuleType.COMMONJS);
      }
    });

    // Detect typeof module.
    tap(PLUGIN_NAME, hooks.typeof, 'module', () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.COMMONJS) { return; }

      setModuleType(module, ModuleType.COMMONJS);
    });
    // Detect expression of require.main, require.cache, module.loaded, module.id and module.exports.
    tap(PLUGIN_NAME, hooks.expression, [
      'require.main', 'require.cache', 'module.loaded', 'module.id', 'module.exports'
    ], () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.COMMONJS) { return; }

      setModuleType(module, ModuleType.COMMONJS);
    });

    // Detect calling of require.
    // !!`new require("./a");` is a semantic error, but Webpack will fix it.
    tapMulti(PLUGIN_NAME, [hooks.call, hooks.new], [
      'require', 'module.require'
    ], expr => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.COMMONJS) { return; }

      if (expr.arguments.length !== 1) { return; }
      setModuleType(module, ModuleType.COMMONJS);
    });

    // Detect calling of require.resolve.
    tap(PLUGIN_NAME, hooks.call, [
      'require.resolve', 'module.require.resolve',
      'require.resolveWeak', 'module.require.resolveWeak',
    ], expr => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.COMMONJS) { return; }

      if (expr.arguments.length !== 1) { return; }
      setModuleType(module, ModuleType.COMMONJS);
    });

    // Detect Webpack HMR in CommonJS module.
    tap(PLUGIN_NAME, hooks.expression, 'module.hot', () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.COMMONJS) { return; }

      setModuleType(module, ModuleType.COMMONJS);
    });
  }

  private detectES(parser: webpack.javascript.JavascriptParser): void {
    // Detect file extension.
    tap(PLUGIN_NAME, parser.hooks.program, null, () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.ES) { return; }

      if (module.request.endsWith('.mjs')) {
        setModuleType(module, ModuleType.ES);
      }
    });

    // Detect import and export.
    tap(PLUGIN_NAME, parser.hooks.program, null, ast => {
      const module = parser.state.closure.module as ClosureModule;
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
      const module = parser.state.closure.module as ClosureModule;
      if (module.type === ModuleType.ES) { return; }

      setModuleType(module, ModuleType.ES);
    });
  }

  private detectUseClosure(parser: webpack.javascript.JavascriptParser): void {
    // Detect use Closure.
    tap(PLUGIN_NAME, parser.hooks.expression, 'goog', () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase || module.requires.has('goog')) { return; }

      // If goog is a free variable, should use Closure.
      if (isFreeVariable(parser, 'goog')) {
        const info: RequireInfo = {
          fullname: 'goog',
          confirmed: true,
          position: 0 // defautls to 0, the head line position.
        };
        // Import goog statement should behind all directives and ahead of all 
        // other import statements.
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

  private parseDefine(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    // Parse goog.define.
    tap(PLUGIN_NAME, hooks.call, 'goog.define', expr => {
      const module = parser.state.closure.module as ClosureModule;

      if (!module.source) {
        throw new PluginError(`Undefined Closure module source at file ${module.request}.`);
      }

      if (!this.tree.isLibraryModule(module.request)) {
        throw new PluginError(`goog.define disallowed outside Clousre library modules.`);
      }

      const nameArg = expr.arguments[0];
      // Error if name prameter missing.
      if (!nameArg) {
        throw new MissingParameterError({
          file: module.request, loc: expr.loc,
          param: 'name'
        });
      }
      // Error if name not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg) {
        throw new PluginError(`Failed to evalute parameter name.`);
      }
      if (typeof evalNameArg.string !== 'string') {
        throw new InvalidParameterError({
          file: module.request, loc: expr.loc,
          param: 'name',
          desc: 'its must be string'
        });
      }

      const param: DefineParam = {
        expr,
        name: evalNameArg.string,
        value: '',
      };

      const valueArg = expr.arguments[1];
      // Error if defaultValue parameter missing.
      if (!valueArg) {
        throw new MissingParameterError({
          file: module.request, loc: expr.loc,
          param: 'defaultValue '
        });
      }
      // The defaultValue parameter in may contains constants that need evaluate 
      // before convert to string.
      const evalValueArg = parser.evaluateExpression(valueArg);
      if (!evalValueArg) {
        throw new PluginError(`Failed to evaluate parameter defaultValue.`);
      }
      if (evalValueArg.isString()) {
        param.value = JSON.stringify(evalValueArg.string);
      } else if (evalValueArg.isBoolean()) {
        param.value = JSON.stringify(evalValueArg.bool);
      } else if (evalValueArg.isNumber()) {
        param.value = JSON.stringify(evalValueArg.number);
      } else if (evalValueArg.isRegExp()) {
        param.value = `${evalValueArg.regExp}`;
      } else if (evalValueArg.isIdentifier()) {
        if (typeof evalValueArg.identifier === 'string') {
          param.value = evalValueArg.identifier;
        } else if (evalValueArg.identifier?.freeName === 'string') {
          param.value = evalValueArg.identifier.freeName;
        } else {
          param.value = module.source.slice(valueArg.range[0], valueArg.range[1]);
        }
      } else if (valueArg.type.endsWith('Expression')) {
        param.value = module.source.slice(valueArg.range[0], valueArg.range[1]);
        // TODO: refactor this.
        // !!NOTE!! This may mess the source.
        for (const [name, value] of this.env.constants.entries()) {
          param.value = param.value.replace(
            new RegExp(name, 'g'),
            JSON.stringify(value)
          );
        }
      } else {
        throw new InvalidParameterError({
          file: module.request, loc: expr.loc,
          param: 'defaultValue',
          desc: 'its must be a string, boolean or number'
        });
      }
      // Check the left part missing.
      const currentStatement = parser.statementPath[parser.statementPath.length - 1];
      if (currentStatement.type === 'ExpressionStatement'
        && currentStatement.expression === expr
      ) {
        param.missingLeft = true;
        if (this.shouldShowWarning(module)) {
          const warning = new PluginError(
            `Left part of the goog.define is missing,` +
            ` this may cause many error,` +
            ` ClosureModuleLoader will fix this by adding "${param.name} = " before the goog.define expression.`
          );
          module.warnings.push(warning);
        }
      }

      // Apply define option.
      const value: any = this.env.defines.get(param.name);
      if (value !== undefined) {
        param.value = value;
      }

      // Append comment.
      const comment = module.source.slice(expr.range[0], expr.range[1]);
      param.value = `/* ${comment} */` + param.value;

      let sames = module.defineParams.get(param.name);
      if (!sames) {
        module.defineParams.set(param.name, sames = []);
      }
      if (sames.length) {
        // Error if current goog.define value and value type not same to last.
        const last = sames[sames.length - 1];
        if (last && last.value !== param.value) {
          throw new InvalidParameterError({
            file: module.request, loc: expr.loc,
            param: 'defaultValue',
            desc: `name ${param.name} has different defaultValue,` +
              ` last is ${last.value} but current is ${param.value}`
          });
        }
      }
      sames.push(param);

      // Return true to stop parse this goog.define expression.
      return true;
    });
  }

  private parseDeps(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    // Detect dependencies file.
    tap(PLUGIN_NAME, hooks.program, null, ast => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase || module.isdeps) { return; }
      const tree = module.tree as ClosureTree;

      // Detect by path, in Closure library only has one deps file.
      if (tree.isLibraryModule(module)) {
        // @ts-ignore
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
      const module = parser.state.closure?.module as ClosureModule;
      if (!module || module.isbase || typeof module.source !== 'string') { return; }
      const tree = module.tree;
      if (!tree) { return; }

      if (module.isdeps === false) {
        throw new UnexpectCallingError({
          file: module.request, loc: expr.loc,
          name: 'goog.addDependency',
          desc: 'outside dependencies file'
        });
      }

      // Error if current statement node range property undefined.
      const currentStatement = parser.statementPath[parser.statementPath.length - 1];
      if (!currentStatement.range
        || typeof currentStatement.range[0] !== 'number'
        || typeof currentStatement.range[1] !== 'number'
      ) {
        throw new PluginError(`Undefined statement range property at file ${module.request}.`);
      }
      const param: DependencyParam = {
        text: module.source.slice(currentStatement.range[0], currentStatement.range[1]),
        relPath: undefined,
        provides: [],
        requires: [],
        flags: {}
      } as any;

      // Parse request.
      const relPathArg = expr.arguments[0];
      // Error if relPath parameter missing.
      if (!expr.arguments[0]) {
        throw new MissingParameterError({
          file: module.request, loc: expr.loc,
          param: 'relPath'
        });
      }
      const evalRelPathArg = parser.evaluateExpression(relPathArg);
      // Error if relPath not string.
      if (!evalRelPathArg?.isString()) {
        throw new InvalidParameterError({
          file: module.request, loc: relPathArg.loc,
          param: 'relPath',
          desc: 'its must be a relative path from base.js'
        });
      }
      // @ts-ignore
      param.relPath = evalRelPathArg.string;

      // Parse provides.
      const providesArg = expr.arguments[1];
      if (providesArg) {
        // Error if provides parameter not array.
        if (providesArg.type !== 'ArrayExpression') {
          throw new InvalidParameterError({
            file: module.request, loc: providesArg.loc,
            param: 'provides',
            desc: 'its must be a string array'
          });
        }

        for (const name of providesArg.elements) {
          // Error if provides element not string.
          const evalName = parser.evaluateExpression(name);
          if (!evalName?.isString()) {
            throw new InvalidParameterError({
              file: module.request, loc: name.loc,
              param: 'provides',
              desc: 'its must be a string array'
            });
          }
          // @ts-ignore
          param.provides.push(evalName.string);
        }
      }

      // Parse requires.
      const requiresArg = expr.arguments[2];
      if (requiresArg) {
        // Error if requires parameter not array.
        if (requiresArg.type !== 'ArrayExpression') {
          throw new InvalidParameterError({
            file: module.request, loc: requiresArg.loc,
            param: 'requires',
            desc: 'its must be a string array'
          });
        }

        for (const name of requiresArg.elements) {
          // Error if requires element not string.
          const evalName = parser.evaluateExpression(name);
          if (!evalName?.isString()) {
            throw new InvalidParameterError({
              file: module.request, loc: name.loc,
              param: 'requires',
              desc: 'its must be a string array'
            });
          }
          // @ts-ignore
          param.requires.push(evalName.string);
        }
      }

      // Parse load flags.
      const flagsArg = expr.arguments[3];
      if (flagsArg) {
        if (flagsArg.type === 'Literal') {
          if (flagsArg.value !== true) {
            throw new InvalidParameterError({
              file: module.request, loc: flagsArg.loc,
              param: 'opt_loadFlags'
            });
          }
          param.flags.module = 'goog';
        } else if (flagsArg.type === 'ObjectExpression') {
          for (const prop of flagsArg.properties) {
            /** @type {string} */
            let key = undefined;
            const evalKey = parser.evaluateExpression(prop.key);
            if (evalKey?.isIdentifier()) {
              key = prop.key.name;
            } else if (evalKey?.isString()) {
              // @ts-ignore
              key = evalKey.string;
            } else {
              throw new InvalidParameterError({
                file: module.request, loc: prop.key.loc,
                param: 'opt_loadFlags'
              });
            }
            if (key !== 'module' && key !== 'lang') {
              throw new InvalidParameterError({
                file: module.request, loc: prop.key.loc,
                param: 'opt_loadFlags',
                desc: `unknow property ${key}`
              });
            }

            const evalValue = parser.evaluateExpression(prop.value);
            if (!evalValue?.isString()) {
              throw new InvalidParameterError({
                file: module.request, loc: prop.key.loc,
                param: 'opt_loadFlags',
                prop: key
              });
            }
            // @ts-ignore
            Object.defineProperty(param.flags, key, { value: evalValue.string.toLowerCase() });
          }
        } else {
          throw new InvalidParameterError({
            file: module.request, loc: flagsArg.loc,
            param: 'opt_loadFlags'
          });
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

  private parseModule(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    const createHandler = funcname => expr => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase) { return; }

      // Error if multi calling.
      if (module.provides.size !== 0) {
        throw new MultiCallingError({
          file: module.request, name: funcname
        });
      }
      // Error if outside ES and CommonJS module.
      if (module.type === ModuleType.PROVIDE || module.type === ModuleType.GOOG) {
        throw new UnexpectCallingError({
          file: module.request, loc: expr.loc,
          name: funcname,
          desc: 'should not use it outside ES and CommonJS module'
        });
      }
      // Error if namespace parameter missing.
      const nameArg = expr.arguments[0];
      if (!nameArg) {
        throw new MissingParameterError({
          file: module.request, loc: expr.loc,
          param: 'namespace'
        });
      }
      // Error if namespace parameter not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg?.isString()) {
        throw new InvalidParameterError({
          file: module.request, loc: nameArg.loc,
          param: 'namespace',
          desc: 'its should be dot-separated sequence of a-z, A-Z, 0-9, _ and $'
        });
      }
      // Warning if calling of deprecated goog.module.declareNamespace.
      if (funcname === 'goog.module.declareNamespace') {
        if (this.shouldShowWarning(module)) {
          const warning = new DeprecateWarning({
            file: module.request, loc: expr.loc,
            name: funcname,
            alternate: 'goog.declareModuleId'
          });
          module.warnings.push(warning);
        }
      }

      // @ts-ignore
      const namespace: string = evalNameArg.string;
      const currentStatement: any = parser.statementPath[parser.statementPath.length - 1];
      if (currentStatement === undefined) {
        throw new PluginError(`Missing current statement at file ${module.request}.`);
      }
      module.addProvide(namespace, {
        fullname: namespace,
        expr,
        statement: currentStatement
      });
    };
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
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase) { return; }

      // Error if multi calling of goog.module.
      if (module.type === ModuleType.GOOG) {
        throw new MultiCallingError({ file: module.request, name: 'goog.module' });
      }
      // Error if goog.module not first statement.
      // @ts-ignore
      const currentStatement: StatementNode = parser.statementPath[parser.statementPath.length - 1];
      for (const statement of parser.state.closure.ast.body) {
        if (statement === currentStatement) { break; }
        if (!isDirectiveStatement(statement)) {
          throw new PluginError(`goog.module must be first statement at file ${module.request}.`);
        }
      }
      // Error if name parameter missing.
      const nameArg = expr.arguments[0];
      if (nameArg === undefined) {
        throw new MissingParameterError({
          file: module.request, loc: expr.loc,
          param: 'name'
        });
      }
      // Error if name parameter not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg?.isString()) {
        throw new InvalidParameterError({
          file: module.request, loc: nameArg.loc,
          param: 'name'
        });
      }

      // @ts-ignore
      const namespace: string = evalNameArg.string;
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
        fullname: namespace,
        expr,
        statement: currentStatement,
        id: 'exports'
      });
    });

    // Parse goog.module.declareLegacyNamespace.
    tap(PLUGIN_NAME, hooks.call, 'goog.module.declareLegacyNamespace',
      expr => {
        const module = parser.state.closure.module as ClosureModule;
        if (module.isbase) { return; }

        // Error if calling outside GOOG module.
        if (module.type !== ModuleType.GOOG) {
          throw new UnexpectCallingError({
            file: module.request, loc: expr.loc,
            name: 'goog.module.declareLegacyNamespace',
            desc: 'outside GOOG module'
          });
        }

        const info = Array.from(module.provides.values())[0];
        if (!info) {
          throw new PluginError(`Missing provide information at file ${module.request}.`);
        }
        const namespace: string = info.fullname;
        const namespaceRoot = namespace.split('.')[0];
        // In legacy GOOG module, error if provided namespace root conflict with 
        // local variable declaration.
        if (!isFreeVariable(parser, namespaceRoot)) {
          const loc: any = info.expr?.loc;
          throw new NamespaceConflictError({
            file: module.request, loc,
            namespace,
            what: 'local variable declaration',
            desc: 'the provided namespace is reserved in legacy GOOG module'
          });
        }

        const currentStatement: any = parser.statementPath[parser.statementPath.length - 1];
        if (currentStatement === undefined) {
          throw new PluginError('Missing current statement.');
        }
        module.legacy = currentStatement;
      }
    );

    // In GOOG module, record declaration of the exported local variable.
    tap(PLUGIN_NAME, hooks.declarator, null, (declarator, statement) => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase) { return; }

      // Stop if not GOOG module.
      if (module.type !== ModuleType.GOOG) { return; }

      const info = Array.from(module.provides.values())[0];
      if (!info) {
        throw new PluginError(`Missing provide information at file ${module.request}.`);
      }
      if (declarator.id.name === info.id) {
        info.declaration = statement;
      }
    });
  }

  private parseProvides(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    // Parse goog.provide.
    tap(PLUGIN_NAME, hooks.call, 'goog.provide', expr => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase) { return; }

      // Error if name parameter missing.
      const nameArg = expr.arguments[0];
      if (!nameArg) {
        throw new MissingParameterError({
          file: module.request, loc: expr.loc,
          param: 'name'
        });
      }
      // Error if name parameter not string.
      const evalNameArg = parser.evaluateExpression(nameArg);
      if (!evalNameArg?.isString()) {
        throw new InvalidParameterError({
          file: module.request, loc: expr.loc,
          param: 'name'
        });
      }

      // @ts-ignore
      const namespace: string = evalNameArg.string;
      const namespaceRoot = namespace.split('.')[0];
      // Error if provided namespace conflict with local variable declaration. 
      if (!isFreeVariable(parser, namespaceRoot)) {
        throw new NamespaceConflictError({
          file: module.request, loc: nameArg.loc,
          namespace,
          what: 'local variable declaration',
          desc: `you can direct use the globally accessible object or the variable should use another name`
        });
      }

      // Tag this provided namespace root to record usages.
      if (parser.getTagData(namespaceRoot, namespaceTag) === undefined) {
        parser.tagVariable(namespaceRoot, namespaceTag, namespaceRoot);
      }

      if (this.shouldShowWarning(module)) {
        const warning = new DeprecateWarning({
          file: module.request, loc: expr.loc,
          name: 'goog.provide',
          alternate: 'goog.module'
        });
        module.warnings.push(warning);
      }

      setModuleType(module, ModuleType.PROVIDE);
      const currentStatement: any = parser.statementPath[parser.statementPath.length - 1];
      if (currentStatement === undefined) {
        throw new PluginError(`Missing current statement at file ${module.request}.`);
      }
      module.addProvide(namespace, {
        fullname: namespace,
        expr,
        statement: currentStatement
      });
    });

    // Parse implicit namespaces of provide information, only for PROVIDE and
    // legacy GOOG module.
    tap(PLUGIN_NAME, hooks.finish, null, () => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase) { return; }

      module.parseImplicities();
    });
  }

  private parseRequires(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    // Parse goog.require and require information.
    tap(PLUGIN_NAME, hooks.call, 'goog.require', expr => {
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase) { return; }

      const nameArg = expr.arguments[0];
      // Error if namespace parameter missing.
      if (!nameArg) {
        throw new MissingParameterError({
          file: module.request, loc: expr.loc,
          param: 'namespace'
        });
      }
      const evalNameArg = parser.evaluateExpression(nameArg);
      // Error if namespace parameter not string.
      if (!evalNameArg?.isString()) {
        throw new InvalidParameterError({
          file: module.request, loc: expr.loc,
          param: 'namespace'
        });
      }

      // @ts-ignore
      const namespace: stirng = evalNameArg.string;
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
          throw new NamespaceConflictError({
            file: module.request, loc: nameArg.loc,
            namespace,
            what: 'local variable declaration',
            desc: 'the required namespace is reserved in PROVIDE and legacy GOOG module,' +
              ' you can direct use the globally accessible object or the variable should use another name'
          });
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

      // @ts-ignore
      const currentStatement: StatementNode = parser.statementPath[parser.statementPath.length - 1];
      if (!currentStatement) {
        throw new PluginError(`Undefined statement at file ${module.request}.`);
      }
      if (!currentStatement.range
        || typeof currentStatement.range[0] !== 'number'
        || typeof currentStatement.range[1] !== 'number'
      ) {
        throw new PluginError(`Undefined statement range property at file ${module.request}.`);
      }
      const info: RequireInfo = {
        fullname: namespace,
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
          if (this.shouldShowWarning(module)) {
            const warning = new BadRequire({
              file: module.request, loc: expr.loc,
              desc: `goog.require always return null in PROVIDE module,` +
                ` you can direct use the globally accessible object`
            });
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
      const module = parser.state.closure.module as ClosureModule;
      if (module.isbase) { return; }

      const calleeName: string = ['goog'].concat(calleeMembers).join('.');
      // Stop if callee object not goog.require.
      if (calleeName !== 'goog.require') { return; }

      // In PROVIDE module, error if use memberChain and callMemberChain of goog.require.
      // Only check current module type, the required module type is still unknow now.
      if (module.type === ModuleType.PROVIDE) {
        throw new BadRequire({
          file: module.request, loc: expr.loc,
          desc: `goog.require always return null in PROVIDE module,` +
            ` you can direct use the globally accessible object`
        });
      }
    });
  }

  private parseNamespaceUsage(parser: webpack.javascript.JavascriptParser): void {
    const hooks = parser.hooks;

    // Warning if modify required namespace;
    // Warning if modify implicit namespace;
    tapMulti(PLUGIN_NAME, [
      hooks.assign, hooks.assignMemberChain
    ], namespaceTag, (expr, members) => {
      const module = parser.state.closure.module as ClosureModule;

      const namespaceRoot: string = parser.currentTagData;
      const namespace: string = [namespaceRoot].concat(members || []).join('.');
      if (this.shouldShowWarning(module)) {
        switch (module.getNamespaceType(namespace).type) {
          case 'require': {
            // Warning if modify required namespace.
            const warning = new ModifyRequiredNamespaceWarning({
              file: module.request, loc: expr.loc,
              namespace
            });
            module.warnings.push(warning);
            break;
          }
          case 'implicit': {
            // Warning if modify implicit namespace.
            const warning = new ModifyImplicitNamespaceWarning({
              file: module.request, loc: expr.loc,
              namespace
            });
            module.warnings.push(warning);
            break;
          }
        }
      }
    });

    // Record namespace usages in PROVIDE and legacy GOOG module.
    // Simple parse the expression of provided and required namespaceroot, all
    // memberChain, callMemberChain,  memberChainOfCallMemberChain and 
    // callMemberChainOfCallMemberChain will trigger expression at last.
    tap(PLUGIN_NAME, hooks.expression, namespaceTag, expr => {
      const module = parser.state.closure.module as ClosureModule;

      // Stop if Closure library module.
      if (this.tree.isLibraryModule(module)) { return; }
      const namespaceRoot: string = parser.currentTagData;
      // Stop if namespace start with goog.
      if (namespaceRoot === 'goog') { return; }
      if (module.type === ModuleType.PROVIDE || module.legacy) {
        // Record this usage.
        let usages = module.namespaceUsages.get(namespaceRoot);
        if (usages === undefined) {
          module.namespaceUsages.set(namespaceRoot, usages = []);
        }
        usages.push(expr);
      } else {
        // Error if using namespace outside PROVIDE and legacy GOOG module.
        throw new NamespaceOutModuleError({
          file: module.request, loc: expr.loc,
          namespace: namespaceRoot
        });
      }
    });
  }

  apply(parser: webpack.javascript.JavascriptParser): void {
    this.common(parser);
    this.detectBaseFile(parser);
    this.detectCommonJS(parser);
    this.detectES(parser);
    this.detectUseClosure(parser);
    // this.parseAnnotation(parser);
    this.parseDefine(parser);
    this.parseDeps(parser);
    this.parseModule(parser);
    this.parseProvides(parser);
    this.parseRequires(parser);
    this.parseNamespaceUsage(parser);
  }
}
