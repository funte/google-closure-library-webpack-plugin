'use strict';

/** @typedef {import('estree').ArrayExpression} ArrayExpressionNode */
/** @typedef {import('estree').BlockStatement} BlockStatementNode */
/** @typedef {import('estree').Comment} CommentNode */
/** @typedef {import('estree').CallExpression} CallExpressionNode */
/** @typedef {import('estree').Directive} DirectiveNode */
/** @typedef {import('estree').Expression} ExpressionNode */
/** @typedef {import('estree').Identifier} IdentifierNode */
/** @typedef {import('estree').Literal} LiteralNode */
/** @typedef {import('estree').Node} Node */
/** @typedef {import('estree').ObjectExpression} ObjectExpressionNode */
/** @typedef {import('estree').Program} ProgramNode */
/** @typedef {import('estree').ReturnStatement} ReturnStatementNode */
/** @typedef {import('estree').SourceLocation} SourceLocation */
/** @typedef {import('estree').Statement} StatementNode */
/** @typedef {import('tapable').HookMap} WPHookMap */
/** @typedef {import('tapable').SyncBailHook} WPSyncBailHook */
/** @typedef {import('webpack').Compilation} WPCompilation */
/** @typedef {import('webpack').Compiler} WPCompiler */
/** @typedef {import('webpack').javascript.JavascriptParser} WPJavascriptParser */
/** @typedef {import('webpack').NormalModule} WPNormalModule */
/** @typedef {import('webpack').ParserState} WPParserState */
/** @typedef {import('webpack-sources').Source} WPSource */
/** @typedef {import('webpack-sources').ReplaceSource} WPReplaceSource */

/** @typedef {import('./Plugin')} Plugin */
/**
 * @typedef {object} PluginDebugOptions
 * @property {boolean} [logTransformed] Enable log transformed Closure module to build directory, defaults to false.
 */
/**
 * @typedef {object} PluginOptions
 * @property {string} [base] Path to Closure library base.js file, must be absolute or relative from the environment context.
 * @property {string | string[]} sources List of absolute patterns, or relative from the environment context.
 * @property {'esm' | 'commonjs'} [target] Closure module transform target, "esm" or "commonjs", defaults to "esm".
 * @property {any[]} [defs] List of string and value to override the goog.define expression, if the name part is omitted, its value will be true.
 * @property {PluginDebugOptions} [debug]
 */

/** @typedef {import('./errors/PluginError')} PluginError */

/** @typedef {import('./Environment')} Environment */

/** @typedef {import('./closure/ClosureModule')} ClosureModule */
/** @typedef {import('./closure/ClosureModuleFactory')} ClosureModuleFactory */
/** @typedef {import('./closure/ClosureTree')} ClosureTree */
/** @typedef {import('./closure/ModuleState')} ModuleState */
/** @typedef {import('./closure/ModuleType')} ModuleType */
/** 
 * Namespace object that used mange and present namespace structure.
 * @typedef {object} Namespace
 * @property {string} name This namespace name.
 * @property {Map<string, Namespace>} subs Sub parts.
 */
/**
 * Used to store parsed goog.define parameters.
 * @typedef {object} DefineParam
 * @property {ExpressionNode} expr The goog.define expression.
 * @property {string} name The name parameter.
 * @property {string} value The defaultValue parameter.
 * @property {'string' | 'boolean' | 'number' | 'RegExp' | 'function' | 'expression'} valueType The defaultValue parameter data type.
 */
/** 
 * Dependency param that used to store parsed goog.addDependency parameters.
 * @typedef {object} DependencyParam
 * @property {string} text Source of the goog.addDependency statement.
 * @property {string} relPath The relative path from base.js to the js file.
 * @property {string[]} provides An array of strings with the names of the objects this file provides.
 * @property {string[]} requires An array of strings with the names of the objects this file requires.
 * @property {Object<?, string>} flags Parameters indicate the Closure module type and language version.
 */
/**
 * Record require information.
 * @typedef {object} RequireInfo
 * @property {string} namespace This required name.
 * @property {boolean} confirmed True if get from goog.require expression.
 * @property {number} position Insert position for transformed import statement.
 * @property {ExpressionNode} [expr] The goog.require expression, undefined if not confirmed.
 * @property {StatementNode} [statement] The goog.require statement.
 * @property {boolean} [used] True if the goog.require expression result is used.
 */
/**
 * Record provide information.
 * @typedef {object} ProvideInfo
 * @property {string} namespace This provided name.
 * @property {ExpressionNode} [expr] The provide expression, e.g. goog.module/provide/declareModuleId/declareNamespace.
 * @property {StatementNode} [statement] The provide statement.
 * @property {string[]} [implicities] The implicit namespaces need construct, only defined in PROVIDE and legacy GOOG module.
 * @property {string} [id] Exported local variable, defaults to exports, only defined in base.js and GOOG module.
 * @property {StatementNode} [declaration] Declaration of the exported local variable, only defined in GOOG module.
 */
/**
 * More information see ClosureModule.getNamespaceType
 * @typedef {object} NamespaceInfo
 * @property {'provide' | 'require' | 'implicit' | 'unknow'} type Always "unknow" outside PROVIDE and legacy GOOG module.
 * @property {string} [owner] Its owner namespace.
 */
/**
 * Represent a single JSDoc annotation, with an optional argument, e.g. @provideGoog, @type {string}.
 * @typedef {Object} ClosureCommentAnnotation
 * @property {string} name
 * @property {string} [value]
 * @property {SourceLocation} [loc]
 */

/** @typedef {import('./source/Sources').MatchState} MatchState */
/** @typedef {import('./source/Sources').Sources} Sources */
/**
 * @typedef {object} ScanResult
 * @property {string[]} files All files found.
 * @property {string[]} added New added files from last scanning.
 * @property {string[]} modified Modified files from last scanning.
 * @property {string[]} removed Removed files from last scanning.
 * @property {string[]} missing Missing patterns that throw ENOENT exception.
 */

// 必须的, 不能删.
module.exports = {};
