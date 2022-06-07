import { expect } from 'chai';
import { RawSource } from 'webpack-sources';

import { ModuleType } from '../src/closure/ClosureModule';
import { transform } from '../src/transformation/ClosureModuleTransform';
import { ClosureTree } from '../src/closure/ClosureTree';
import { Environment } from '../src/Environment';
import { generate, GenerateContext } from '../src/transformation/generate';
import { resolveRequest } from '../src/utils/resolveRequest';
import {
  getTransTarget,
  getRelativeRequest,
  getRequiredVar,
  getRequireIdentifier,
  getRequireStatement,
  getExportStatement
} from '../src/transformation/template';

import { GoogDefineTrans } from '../src/transformation/transform/GoogDefineTrans';
import { GoogRequireTrans } from '../src/transformation/transform/GoogRequireTrans';
import { GoogProvideTrans } from '../src/transformation/transform/GoogProvideTrans';

describe('test transformation', () => {
  describe('test transformation/template', () => {
    it('test getModuleTarget', () => {
      // COMMONJS module target should always be "commonjs".
      expect(getTransTarget({ type: ModuleType.COMMONJS } as any)).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.COMMONJS } as any, 'commonjs')).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.COMMONJS } as any, 'esm')).to.equal('commonjs');

      // ES module target should always be "esm".
      expect(getTransTarget({ type: ModuleType.ES } as any)).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.ES } as any, 'commonjs')).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.ES } as any, 'esm')).to.equal('esm');

      // Other module target defaults to "esm".
      expect(getTransTarget({ type: ModuleType.SCRIPT } as any)).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.PROVIDE } as any)).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.GOOG } as any)).to.equal('esm');

      // Non ES module with "commonjs" option, target should be "commonjs".
      expect(getTransTarget({ type: ModuleType.SCRIPT } as any, 'commonjs')).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.PROVIDE } as any, 'commonjs')).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.GOOG } as any, 'commonjs')).to.equal('commonjs');

      // Non CommonJS module with "esm" option, target should be "esm".
      expect(getTransTarget({ type: ModuleType.SCRIPT } as any, 'esm')).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.PROVIDE } as any, 'esm')).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.GOOG } as any, 'esm')).to.equal('esm');
    });

    it('test getRelativeRequest', () => {
      expect(getRelativeRequest('a\\b', 'a\\c')).to.equal('./c');
      expect(getRelativeRequest('\\a\\b', '\\a\\c')).to.equal('./c');
      expect(getRelativeRequest('a:\\b', 'a:\\c')).to.equal('./c');
    });

    it('test getRequireVar', () => {
      // Only require non PROVIDE module outside PROVIDE module, should has require variable.
      expect(getRequiredVar(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.SCRIPT } as any,
        'a.b',
        { used: true } as any
      )).to.equal('__a_b__');

      // If expression result not used, should not has require variable.
      expect(getRequiredVar(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.SCRIPT } as any,
        'a.b',
        { used: false } as any
      )).to.equal(null);

      // In PROVIDE module,  should not has require variable.
      expect(getRequiredVar(
        { type: ModuleType.PROVIDE } as any,
        { type: ModuleType.SCRIPT } as any,
        'a.b',
        { used: true } as any
      )).to.equal(null);

      // Require a PROVIDE module, should not has require variable.
      expect(getRequiredVar(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.PROVIDE } as any,
        'a.b',
        { used: true } as any
      )).to.equal(null);
    });

    it('test getRequireIdentifier', () => {
      // If expression result not used, should return null.
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.SCRIPT } as any,
        'a.b',
        { used: false } as any
      )).to.equal(null);

      // Require non PROVIDE module outside PROVIDE module, should use the require
      // local variable.
      const requireVar = getRequiredVar(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.SCRIPT } as any,
        'a.b',
        { used: true } as any
      );
      expect(requireVar).to.string;
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.SCRIPT } as any,
        'a.b',
        { used: true } as any
      )).to.equal(requireVar);

      // In PROVIDE module, should always return 'null'.
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE } as any,
        { type: ModuleType.SCRIPT } as any,
        'a.b',
        { used: true } as any
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE } as any,
        { type: ModuleType.PROVIDE } as any,
        'a.b',
        { used: true } as any
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE } as any,
        { type: ModuleType.COMMONJS } as any,
        'a.b',
        { used: true } as any
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE } as any,
        { type: ModuleType.ES } as any,
        'a.b',
        { used: true } as any
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE } as any,
        { type: ModuleType.GOOG } as any,
        'a.b',
        { used: true } as any
      )).to.equal('null');

      // Require a Closure library PROVIDE module outside PROVIDE module, should 
      // return the globally accessible object.
      // !!Here assume goog.math is a PROVIDE module.
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.PROVIDE } as any,
        'goog.math',
        { used: true } as any
      )).to.equal('goog.math');
      // Require a non Closure library PROVIDE module outside PROVIDE module, 
      // the result should has "goog.global" prefix.
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT } as any,
        { type: ModuleType.PROVIDE } as any,
        'a.b',
        { used: true } as any
      )).to.equal('goog.global.a.b');
    });

    it('test getRequireStatement', () => {
      // Test with undefined requireVar with default target "esm".
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.SCRIPT, request: 'a/c' } as any
      )).to.equal('import "./c";\n');
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.SCRIPT, request: 'a/c' } as any,
        undefined
      )).to.equal('import "./c";\n');
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.SCRIPT, request: 'a/c' } as any,
        null
      )).to.equal('import "./c";\n');
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.SCRIPT, request: 'a/c' } as any,
        ''
      )).to.equal('import "./c";\n');

      // Test undefined requireVar with "commonjs" target.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.SCRIPT, request: 'a/c' } as any,
        null,
        'commonjs'
      )).to.equal('require("./c");\n');

      // Test requireVar with default target.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.SCRIPT, request: 'a/c' } as any,
        '__a_c__'
      )).to.equal('import __a_c__ from "./c";\n');
      // Test requireVar with "commonjs" target.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.SCRIPT, request: 'a/c' } as any,
        '__a_c__',
        'commonjs'
      )).to.equal('var __a_c__ = require("./c");\n');

      // Test requireVar with ES module.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' } as any,
        { type: ModuleType.ES, request: 'a/c' } as any,
        '__a_c__',
      )).to.equal('import * as __a_c__ from "./c";\n');
    });

    it('test getExportStatement', () => {
      expect(getExportStatement(
        { type: ModuleType.SCRIPT } as any,
        'goog'
      )).to.equal('export default goog;\n');
      expect(getExportStatement(
        { type: ModuleType.SCRIPT } as any,
        'goog',
        'commonjs'
      )).to.equal('module.exports = goog;\n');
    });
  });

  const env = new Environment({
    context: resolveRequest('fixtures', __dirname),
    globalObject: 'window || this || self',
    warningLevel: 'show'
  });
  const tree = new ClosureTree({
    base: '../../node_modules/google-closure-library/closure/goog/base.js',
    sources: [
      // For mock module request.
      'path/to/**/*'
    ],
    env
  });
  const generateContext: GenerateContext = { tree, env };

  describe('test transformation/transform', () => {
    describe('test GoogRequireTrans', () => {
      it('transform use Closure', () => {
        tree.clear();
        // Rescan to get the Clousre library namespace goog.
        tree.scan();
        const module: any = tree.loadModule('path/to/module',
          `console.log(goog.DEBUG);\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const info: any = module.requires.get('goog');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(/^import\sgoog\sfrom\s"[^"]+";\r?\nconsole.log\(goog\.DEBUG\);\r?\n$/i.test(source.source())).to.true;
      });

      it('require non PROVIDE module outside PROVIDE module, has semicolon', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const module: any = tree.loadModule('path/to/a',
          `const c = goog.require("a.c");\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const info: any = module.requires.get('a.c');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import __a_c__ from "./c";\n` +
          `const c = __a_c__;\n`
        );
      });

      it('require non PROVIDE module outside PROVIDE module, without semicolon', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const module: any = tree.loadModule('path/to/a',
          `const c = goog.require("a.c")\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const info: any = module.requires.get('a.c');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import __a_c__ from "./c";\n` +
          `const c = __a_c__\n`
        );
      });

      it('require non PROVIDE module outside PROVIDE module, expression result not used, without LF charracter', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const module: any = tree.loadModule('path/to/a',
          `goog.require("a.c");something();\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const info: any = module.requires.get('a.c');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import "./c";\n` +
          `something();\n`
        );
      });

      it('require a non PROVIDE module outside PROVIDE module, access required module with dot', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const module: any = tree.loadModule('path/to/a',
          `const val = goog.require("a.c").val;\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const info = module.requires.get('a.c');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import __a_c__ from "./c";\n` +
          `const val = __a_c__.val;\n`
        );
      });

      it('if expression result not used, should not has require identifier', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const module: any = tree.loadModule('path/to/a',
          `goog.require("a.c");\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const info: any = module.requires.get('a.c');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import "./c";\n`
        );
      });

      it('require a Closure library PROVIDE module outside PROVIDE module, should direct use the globally accessible object', () => {
        tree.clear();
        // Rescan to get the Closure library namespace goog.math.
        tree.scan();
        // Original module is a SCRIPT module.
        const module: any = tree.loadModule('path/to/a',
          `const math = goog.require("goog.math");\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const info: any = module.requires.get('goog.math');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(/^import\s"[^"]+";\r?\nconst\smath\s=\sgoog.math;\r?\n$/i.test(source.source())).to.true;
      });

      it('require a non Closure library PROVIDE module outside PROVIDE module, should has "goog.global" prefix', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const module: any = tree.loadModule('path/to/a',
          `const c = goog.require("a.c");\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.provide("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(module.source);
        const info: any = module.requires.get('a.c');
        expect(info).to.exist;
        const trans = new GoogRequireTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import "./c";\n` +
          `const c = goog.global.a.c;\n`
        );
      });
    });

    describe('test GoogProvideTrans', () => {
      it('non Closure library PROVIDE module', () => {
        tree.clear();
        // Original module is a PROVIDE module.
        const module: any = tree.loadModule('path/to/module',
          `goog.provide("a.b");\n` +
          `goog.provide("a.b.c.d");\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const info1: any = module.provides.get('a.b');
        expect(info1).to.exist;
        const trans1 = new GoogProvideTrans(module, info1);
        const info2: any = module.provides.get('a.b.c.d');
        expect(info2).to.exist;
        const trans2 = new GoogProvideTrans(module, info2);
        const source = generate(originalSource, [trans1, trans2], generateContext);
        expect(source.source()).to.equal(
          `/* construct implicit namespace goog.global.a */goog.global.a = goog.global.a || {};\n` +
          `/* construct provided namespace goog.global.a.b */goog.global.a.b = goog.global.a.b || {};\n` +
          `/* construct implicit namespace goog.global.a.b.c */goog.global.a.b.c = goog.global.a.b.c || {};\n` +
          `/* construct provided namespace goog.global.a.b.c.d */goog.global.a.b.c.d = goog.global.a.b.c.d || {};\n`
        );
      });

      it('Closure library PROVIDE module', () => {
        tree.clear();
        // Rescan to get the Closure library namespace goog.math.
        tree.scan();
        const module: any = tree.getModule('goog.math');
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        // Reload this module with given source.
        // Now a.b and a.b.c.d also become Closure library namespace.
        tree.reloadModule(module.request,
          `goog.provide("a.b");\n` +
          `goog.provide("a.b.c.d");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(module.source);
        const info1: any = module.provides.get('a.b');
        expect(info1).to.exist;
        const trans1 = new GoogProvideTrans(module, info1);
        const info2: any = module.provides.get('a.b.c.d');
        expect(info2).to.exist;
        const trans2 = new GoogProvideTrans(module, info2);
        expect(trans2.info).to.exist;
        const source = generate(originalSource, [trans1, trans2], generateContext);
        expect(source.source()).to.equal(
          `/* construct implicit namespace a */a = a || {};\n` +
          `/* construct provided namespace a.b */a.b = a.b || {};\n` +
          `/* construct implicit namespace a.b.c */a.b.c = a.b.c || {};\n` +
          `/* construct provided namespace a.b.c.d */a.b.c.d = a.b.c.d || {};\n`
        );
      });

      it('GOOG module with default "esm" target, has exports declaration', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `var exports = {};\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const info: any = module.provides.get('a.b');
        expect(info).to.exist;
        const trans = new GoogProvideTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `export default exports;\n`
        );
      });

      it('GOOG module with "commonjs" target, has exports declaration', () => {
        const oldtarget = env.target;
        (env as any).target = 'commonjs';

        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `var exports = {};\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const info: any = module.provides.get('a.b');
        expect(info).to.exist;
        const trans = new GoogProvideTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `module.exports = exports;\n`
        );

        (env as any).target = oldtarget;
      });

      it('GOOG module with default "esm" target, without exports declaration', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.module("a.b");\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const info: any = module.provides.get('a.b');
        expect(info).to.exist;
        const trans = new GoogProvideTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `export default exports;\n`
        );
      });

      it('non Closure library legacy GOOG module, without exports declaration', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `goog.module.declareLegacyNamespace();\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const info: any = module.provides.get('a.b');
        const trans = new GoogProvideTrans(module, info);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `/* construct implicit namespace goog.global.a */goog.global.a = goog.global.a || {};\n` +
          `goog.global.a.b = exports;\n` +
          `export default exports;\n`
        );
      });
    });

    describe('test GoogDefineTrans', () => {
      it('COMPILED and goog.define in Closure library base.js file', () => {
        tree.clear();
        expect(tree.basefile).to.exist;
        const module: any = tree.loadModule(tree.basefile as any,
          `var COMPILED = false;\n` +
          `goog.DEBUG = goog.define("goog.DEBUG", true);\n` +
          `if (!COMPILED) { };\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const param = module.defineParams.get('goog.DEBUG')[0];
        const trans = new GoogDefineTrans(module, param);
        const source = generate(originalSource, [trans, ...module.trans], generateContext);
        expect(source.source()).to.equal(
          `goog.DEBUG = /* goog.define("goog.DEBUG", true) */false;\n` +
          `if (!/* COMPILED */true) { };\n`
        );
      });

      it('missing left part of genenal variable', () => {
        tree.clear();
        // Mock Closure library module.
        const module: any = tree.loadModule(tree.basefile,
          // a is general variable, not any namespace.
          `goog.define("a", false);\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const param = module.defineParams.get('a')[0];
        expect(param).to.exist;
        expect(param.missingLeft).to.true;
        const trans = new GoogDefineTrans(module, param);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `a = /* goog.define("a", false) */false;\n`
        );
      });

      it('missing left part of Clousre library namespce', () => {
        tree.clear();
        expect(tree.basefile).to.exist;
        const module: any = tree.loadModule(tree.basefile as any,
          // goog is a Closure library namespace.
          `goog.define("goog.DEBUG", false);\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        const originalSource = new RawSource(module.source);
        const param = module.defineParams.get('goog.DEBUG')[0];
        expect(param).to.exist;
        expect(param.missingLeft).to.true;
        const trans = new GoogDefineTrans(module, param);
        const source = generate(originalSource, trans, generateContext);
        expect(/goog.DEBUG\s=\s\/\*\s+[^]+\*\/false;/.test(source.source())).to.true;
      });
    });
  });

  describe('test ClosureModuleTransform', () => {
    it('transform base.js file with default target', () => {
      tree.clear();
      // Mock the base.js file.
      const module: any = tree.loadModule(tree.basefile,
        `var COMPILED = true;\n` +
        `goog.global = this || self;\n` +
        // Missing left part.
        `goog.define("name", true);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      const source = transform({
        content: module.source,
        module,
        tree,
        env
      });
      expect(tree.errors).to.empty;
      expect(source.source().toString()).to.equal(
        `goog.global = window || this || self;\n` +
        `name = /* goog.define("name", true) */true;\n` +
        `export default goog;\n`
      );
    });

    it('transform GOOG module with default target', () => {
      tree.clear();
      tree.scan();
      // Original module is a GOOG module.
      const module: any = tree.loadModule('path/to/a',
        `"use strict";\n` +
        `goog.module("a");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `goog.require("a.b");\n` +
        `console.log(a.b);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      // Required module is a PROVIDE module.
      tree.loadModule('path/to/b', `goog.provide("a.b");\n`);
      expect(tree.errors).to.empty;
      const source = transform({
        content: module.source,
        module: module,
        tree,
        env
      });
      expect(tree.errors).to.empty;
      expect(new RegExp(
        `^"use strict";\\r?\\n` +
        `import goog from "[^"]+";\\r?\\n` +
        `var exports = {};\\r?\\n` +
        `import "[^"]+";\\r?\\n` +
        // \/[^\/]+\/ match the comment.
        `console\\.log\\(\\/[^\\/]+\\/goog\\.global\\.a\\.b\\);\\r?\\n` +
        `goog\\.global\\.a = exports;\\r?\\n` +
        `export default exports;\\r?\\n$`,
        'i'
      ).test(source.source().toString())).to.true;
    });

    it('transform PROVIDE module with default target', () => {
      tree.clear();
      tree.scan();
      // Original module is a PROVIDE module.
      const module: any = tree.loadModule('path/to/a',
        `"use strict";\n` +
        `goog.provide("a");\n` +
        `goog.require("a.b");\n` +
        `console.log(a.b);\n`,
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      // Required module is also a PROVIDE module.
      tree.loadModule('path/to/b', `goog.provide("a.b");\n`);
      expect(tree.errors).to.empty;
      const source = transform({
        content: module.source,
        module: module,
        tree,
        env
      });
      expect(new RegExp(
        `^"use strict";\\r?\\n` +
        `import goog from "[^"]+";\\r?\\n` +
        `goog\\.global\\.a = goog\\.global\\.a || {};\\r?\\n` +
        `import "[^"]+";\\r?\\n` +
        `console\\.log\\(goog\\.global\\.a\\.b\\);\\r?\\n$`,
        'i'
      ).test(source.source().toString())).to.true;

      expect(tree.errors).to.empty;
    });
  });
});
