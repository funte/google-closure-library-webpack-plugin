'use strict';

const { expect } = require('chai');
const { describe, it } = require('mocha');
const { RawSource } = require('webpack-sources');

const transform = require('../src/transformation/ClosureModuleTransform');
const ClosureTree = require('../src/closure/ClosureTree');
const Environment = require('../src/Environment');
const generate = require('../src/transformation/generate');
const ModuleType = require('../src/closure/ModuleType');
const resolveRequest = require('../src/utils/resolveRequest');
const {
  getTransTarget,
  getRelativeRequest,
  getRequireVar,
  getRequireIdentifier,
  getRequireStatement,
  getExportStatement
} = require('../src/transformation/template');

const GoogDefineTrans = require('../src/transformation/transform/GoogDefineTrans');
const GoogRequireTrans = require('../src/transformation/transform/GoogRequireTrans');
const GoogProvideTrans = require('../src/transformation/transform/GoogProvideTrans');
const NamespaceUsageTrans = require('../src/transformation/transform/NamespaceUsageTrans');

/** @typedef {import('../src/transformation/generate').GenerateContext} GenerateContext */

describe('test transformation', () => {
  describe('test transformation/template', () => {
    it('test getModuleTarget', () => {
      // COMMONJS module target should always "commonjs".
      expect(getTransTarget({ type: ModuleType.COMMONJS })).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.COMMONJS }, 'commonjs')).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.COMMONJS }, 'esm')).to.equal('commonjs');

      // ES module target should always "esm".
      expect(getTransTarget({ type: ModuleType.ES })).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.ES }, 'commonjs')).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.ES }, 'esm')).to.equal('esm');

      // Other module target defaults to "esm".
      expect(getTransTarget({ type: ModuleType.SCRIPT })).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.PROVIDE })).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.GOOG })).to.equal('esm');

      // Non ES module with "commonjs" option, transform target should be "commonjs".
      expect(getTransTarget({ type: ModuleType.SCRIPT }, 'commonjs')).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.PROVIDE }, 'commonjs')).to.equal('commonjs');
      expect(getTransTarget({ type: ModuleType.GOOG }, 'commonjs')).to.equal('commonjs');

      // Non CommonJS module with "esm" option, transform target should be "esm".
      expect(getTransTarget({ type: ModuleType.SCRIPT }, 'esm')).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.PROVIDE }, 'esm')).to.equal('esm');
      expect(getTransTarget({ type: ModuleType.GOOG }, 'esm')).to.equal('esm');
    });

    it('test getRelativeRequest', () => {
      expect(getRelativeRequest('a\\b', 'a\\c')).to.equal('./c');
      expect(getRelativeRequest('\\a\\b', '\\a\\c')).to.equal('./c');
      expect(getRelativeRequest('a:\\b', 'a:\\c')).to.equal('./c');
    });

    it('test getRequireVar', () => {
      // Only require non PROVIDE module in non PROVIDE module should has require variable.
      expect(getRequireVar(
        { type: ModuleType.SCRIPT }, { type: ModuleType.SCRIPT }, 'a.b', { used: true }
      )).to.equal('__a_b__');

      // If expression result not used, should not has require variable.
      expect(getRequireVar(
        { type: ModuleType.SCRIPT }, { type: ModuleType.SCRIPT }, 'a.b'
      )).to.equal(null);

      // In PROVIDE type module,  should not has require variable.
      expect(getRequireVar(
        { type: ModuleType.PROVIDE }, { type: ModuleType.SCRIPT }, 'a.b', { used: true }
      )).to.equal(null);

      // Require a PROVIDE type module, should not has require variable.
      expect(getRequireVar(
        { type: ModuleType.SCRIPT }, { type: ModuleType.PROVIDE }, 'a.b', { used: true }
      )).to.equal(null);
    });

    it('test getRequireIdentifier', () => {
      // Require non PROVIDE module in non PROVIDE module, should has require identifier.
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT }, { type: ModuleType.SCRIPT }, 'a.b', { used: true }
      )).to.equal('__a_b__');

      // If expression result not used, should not has require identifier.
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT }, { type: ModuleType.SCRIPT }, 'a.b', { used: false }
      )).to.equal(null);

      // In PROVIDE module, should always get 'null'.
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE }, { type: ModuleType.SCRIPT }, 'a.b', { used: true }
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE }, { type: ModuleType.PROVIDE }, 'a.b', { used: true }
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE }, { type: ModuleType.COMMONJS }, 'a.b', { used: true }
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE }, { type: ModuleType.ES }, 'a.b', { used: true }
      )).to.equal('null');
      expect(getRequireIdentifier(
        { type: ModuleType.PROVIDE }, { type: ModuleType.GOOG }, 'a.b', { used: true }
      )).to.equal('null');

      // Require a Closure library PROVIDE module in non PROVIDE module, should direct use the globally 
      // accessible object associated with the namespace.
      // !!Here assume goog.math is a PROVIDE module.
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT }, { type: ModuleType.PROVIDE }, 'goog.math', { used: true }
      )).to.equal('goog.math');
      // Require a non Closure library PROVIDE module in non PROVIDE module, should has "goog.global" prefix.
      expect(getRequireIdentifier(
        { type: ModuleType.SCRIPT }, { type: ModuleType.PROVIDE }, 'a.b', { used: true }
      )).to.equal('goog.global.a.b');
    });

    it('test getRequireStatement', () => {
      // Test with invalid requireVar with default target.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.SCRIPT, request: 'a/c' }
      )).to.equal('import "./c";\n');
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.SCRIPT, request: 'a/c' },
        undefined
      )).to.equal('import "./c";\n');
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.SCRIPT, request: 'a/c' },
        null
      )).to.equal('import "./c";\n');
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.SCRIPT, request: 'a/c' },
        ''
      )).to.equal('import "./c";\n');

      // Test invalid requireVar with "commonjs" target.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.SCRIPT, request: 'a/c' },
        null,
        'commonjs'
      )).to.equal('require("./c");\n');

      // Test valid requireVar with default target.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.SCRIPT, request: 'a/c' },
        '__a_c__'
      )).to.equal('import __a_c__ from "./c";\n');
      // Test valid requireVar with "commonjs" target.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.SCRIPT, request: 'a/c' },
        '__a_c__',
        'commonjs'
      )).to.equal('var __a_c__ = require("./c");\n');

      // Test required ES module.
      expect(getRequireStatement(
        { type: ModuleType.SCRIPT, request: 'a/b' },
        { type: ModuleType.ES, request: 'a/c' },
        '__a_c__',
      )).to.equal('import * as __a_c__ from "./c";\n');
    });

    it('test getExportStatement', () => {
      expect(getExportStatement(
        { type: ModuleType.SCRIPT }, 'goog'
      )).to.equal('export default goog;\n');
      expect(getExportStatement(
        { type: ModuleType.SCRIPT }, 'goog', 'commonjs'
      )).to.equal('module.exports = goog;\n');
    });
  });

  const env = new Environment({ context: resolveRequest('fixtures', __dirname) });
  const tree = new ClosureTree({
    base: '../../node_modules/google-closure-library/closure/goog/base.js',
    sources: [
      // For mock module request.
      'path/to/**/*'
    ],
    env
  });
  const generateContext = { tree, env };

  describe('test transformation/transform', () => {
    describe('test GoogRequireTrans', () => {
      it('transform use Closure', () => {
        tree.clear();
        // Rescan to get the Clousre library namespace goog.
        tree.scan();
        const originalModule = tree.loadModule('path/to/module', `console.log(goog.DEBUG);\n`);
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const requireInfo = originalModule.requires.get('goog');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
        const source = generate(originalSource, trans, generateContext);
        expect(/^import\sgoog\sfrom\s"[^"]+";\r?\nconsole.log\(goog\.DEBUG\);\r?\n$/i.test(source.source())).to.true;
      });

      it('require non PROVIDE module in non PROVIDE module, has semicolon', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const originalModule = tree.loadModule('path/to/a',
          `const c = goog.require("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const requireInfo = originalModule.requires.get('a.c');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import __a_c__ from "./c";\n` +
          `const c = __a_c__;\n`
        );
      });

      it('require non PROVIDE module in non PROVIDE module, without semicolon', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const originalModule = tree.loadModule('path/to/a',
          `const c = goog.require("a.c")\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const requireInfo = originalModule.requires.get('a.c');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import __a_c__ from "./c";\n` +
          `const c = __a_c__\n`
        );
      });

      it('require non PROVIDE module in non PROVIDE module, expression result not used, without LF charracter', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const originalModule = tree.loadModule('path/to/a',
          `goog.require("a.c");something();\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const requireInfo = originalModule.requires.get('a.c');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import "./c";\n` +
          `something();\n`
        );
      });

      it('require a non PROVIDE module in non PROVIDE module, access required module with dot', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const originalModule = tree.loadModule('path/to/a',
          `const val = goog.require("a.c").val;\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const requireInfo = originalModule.requires.get('a.c');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import __a_c__ from "./c";\n` +
          `const val = __a_c__.val;\n`
        );
      });

      it('if expression result not used, should not has require identifier', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const originalModule = tree.loadModule('path/to/a',
          `goog.require("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.module("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const requireInfo = originalModule.requires.get('a.c');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `import "./c";\n`
        );
      });

      it('require a Closure library PROVIDE module in non PROVIDE module, should direct use the globally accessible object associated with the namespace', () => {
        tree.clear();
        // Rescan to get the Closure library namespace goog.math.
        tree.scan();
        // Original module is a SCRIPT module.
        const originalModule = tree.loadModule('path/to/a',
          `const math = goog.require("goog.math");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const requireInfo = originalModule.requires.get('goog.math');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
        const source = generate(originalSource, trans, generateContext);
        expect(/^import\s"[^"]+";\r?\nconst\smath\s=\sgoog.math;\r?\n$/i.test(source.source())).to.true;
      });

      it('require a non Closure library PROVIDE module in non PROVIDE module, should has "goog.global" prefix', () => {
        tree.clear();
        // Original module is a SCRIPT module.
        const originalModule = tree.loadModule('path/to/a',
          `const c = goog.require("a.c");\n`
        );
        expect(tree.errors).to.empty;
        // Required module is a GOOG module.
        tree.loadModule('path/to/c',
          `goog.provide("a.c");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const requireInfo = originalModule.requires.get('a.c');
        expect(requireInfo).to.exist;
        const trans = new GoogRequireTrans(originalModule, requireInfo);
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
        const originalModule = tree.loadModule('path/to/module',
          `goog.provide("a.b");\n` +
          `goog.provide("a.b.c.d");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const trans1 = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b')
        );
        expect(trans1.info).to.exist;
        const trans2 = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b.c.d')
        );
        expect(trans2.info).to.exist;
        const source = generate(originalSource, [trans1, trans2], generateContext);
        expect(source.source()).to.equal(
          `/** construct implicit namespace goog.global.a */goog.global.a = goog.global.a || {};\n` +
          `/** construct provided namespace goog.global.a.b */goog.global.a.b = goog.global.a.b || {};\n` +
          `/** construct implicit namespace goog.global.a.b.c */goog.global.a.b.c = goog.global.a.b.c || {};\n` +
          `/** construct provided namespace goog.global.a.b.c.d */goog.global.a.b.c.d = goog.global.a.b.c.d || {};\n`
        );
      });

      it('Closure library PROVIDE module', () => {
        tree.clear();
        // Rescan to get the Closure library namespace goog.math.
        tree.scan();
        const originalModule = tree.getModule('goog.math');
        expect(originalModule).to.exist;
        // Reload this module with given source.
        // Now a.b and a.b.c.d also become the Closure library namespace.
        tree.reloadModule(originalModule.request,
          `goog.provide("a.b");\n` +
          `goog.provide("a.b.c.d");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const trans1 = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b')
        );
        expect(trans1.info).to.exist;
        const trans2 = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b.c.d')
        );
        expect(trans2.info).to.exist;
        const source = generate(originalSource, [trans1, trans2], generateContext);
        expect(source.source()).to.equal(
          `/** construct implicit namespace a */a = a || {};\n` +
          `/** construct provided namespace a.b */a.b = a.b || {};\n` +
          `/** construct implicit namespace a.b.c */a.b.c = a.b.c || {};\n` +
          `/** construct provided namespace a.b.c.d */a.b.c.d = a.b.c.d || {};\n`
        );
      });

      it('GOOG module with default esm target, has exports declaration', () => {
        tree.clear();
        const originalModule = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `var exports = {};\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const trans = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b')
        );
        expect(trans.info).to.exist;
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `export default exports;\n`
        );
      });

      it('GOOG module with commonjs target, has exports declaration', () => {
        const oldtarget = env.target;
        env.target = 'commonjs';

        tree.clear();
        const originalModule = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `var exports = {};\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const trans = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b')
        );
        expect(trans.info).to.exist;
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `module.exports = exports;\n`
        );

        env.target = oldtarget;
      });

      it('GOOG module with default esm target, without exports declaration', () => {
        tree.clear();
        const originalModule = tree.loadModule('path/to/module',
          `goog.module("a.b");\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const trans = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b')
        );
        expect(trans.info).to.exist;
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `export default exports;\n`
        );
      });

      it('non Closure library legacy GOOG module, without exports declaration', () => {
        tree.clear();
        const originalModule = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `goog.module.declareLegacyNamespace();\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const trans = new GoogProvideTrans(
          originalModule,
          originalModule.provides.get('a.b')
        );
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var exports = {};\n` +
          `/** construct implicit namespace goog.global.a */goog.global.a = goog.global.a || {};\n` +
          `goog.global.a.b = exports;\n` +
          `export default exports;\n`
        );
      });
    });

    describe('test GoogDefineTrans', () => {
      it('goog.define in Closure library base.js file', () => {
        tree.clear();
        const originalModule = tree.loadModule(tree.basefile,
          `var COMPILED = false;\n` +
          `goog.DEBUG = goog.define("goog.DEBUG", true);\n`
        );
        expect(tree.errors).to.empty;
        const originalSource = new RawSource(originalModule.source);
        const trans = [];
        trans.push(new GoogDefineTrans(originalModule, originalModule.defines.get('COMPILED')));
        trans.push(new GoogDefineTrans(originalModule, originalModule.defines.get('goog.DEBUG')));
        const source = generate(originalSource, trans, generateContext);
        expect(source.source()).to.equal(
          `var COMPILED = true;\n` +
          `goog.DEBUG = false;\n`
        );
      });
    });
  });

  describe('test ClosureModuleTransform', () => {
    it('transform GOOG module with default target', () => {
      tree.clear();
      tree.scan();
      // Original module is a GOOG module.
      const originalModule = tree.loadModule('path/to/a',
        `"use strict";\n` +
        `goog.module("a");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `goog.require("a.b");\n` +
        `console.log(a.b);\n`
      );
      // Required module is a PROVIDE module.
      tree.loadModule('path/to/b', `goog.provide("a.b");\n`);
      const result = transform({
        content: originalModule.source,
        module: originalModule,
        tree,
        env
      });
      expect(new RegExp(
        `^"use strict";\\r?\\n` +
        `import goog from "[^"]+";\\r?\\n` +
        `var exports = {};\\r?\\n` +
        `goog\\.global\\.a = exports;\\r?\\n` +
        `import "[^"]+";\\r?\\n` +
        // \/[^\/]+\/ match the comment.
        `console\\.log\\(\\/[^\\/]+\\/goog\\.global\\.a\\.b\\);\\r?\\n` +
        `export default exports;\\r?\\n$`,
        'i'
      ).test(result.source())).to.true;

      expect(tree.errors).to.empty;
    });

    it('transform PROVIDE module with default target', () => {
      tree.clear();
      tree.scan();
      // Original module is a PROVIDE module.
      const originalModule = tree.loadModule('path/to/a',
        `"use strict";\n` +
        `goog.provide("a");\n` +
        `goog.require("a.b");\n` +
        `console.log(a.b);\n`,
      );
      // Required module is also a PROVIDE module.
      tree.loadModule('path/to/b', `goog.provide("a.b");\n`);
      const result = transform({
        content: originalModule.source,
        module: originalModule,
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
      ).test(result.source())).to.true;

      expect(tree.errors).to.empty
    });
  });
})