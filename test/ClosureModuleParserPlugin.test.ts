import { expect } from 'chai';

import { ClosureTree } from '../src/closure/ClosureTree';
import { ModuleState, ModuleType } from '../src/closure/ClosureModule';
import { Environment } from '../src/Environment';
import { resolveRequest } from '../src/utils/resolveRequest';

import { BadRequire } from '../src/errors/BadRequire';
import { DeprecateWarning } from '../src/errors/DeprecateWarning';
import { InvalidNamespaceError } from '../src/errors/InvalidNamespaceError';
import { InvalidParameterError } from '../src/errors/InvalidParameterError';
import { MissingParameterError } from '../src/errors/MissingParameterError';
import { MultiCallingError } from '../src/errors/MultiCallingError';
import { ModifyImplicitNamespaceWarning } from '../src/errors/ModifyImplicitNamespaceWarning';
import { ModifyRequiredNamespaceWarning } from '../src/errors/ModifyRequiredNamespaceWarning'
import { NamespaceConflictError } from '../src/errors/NamespaceConflictError';
import { NamespaceOutModuleError } from '../src/errors/NamespaceOutModuleError';
import { UnexpectCallingError } from '../src/errors/UnexpectCallingError';

describe('Test ClosureModuleParserPlugin', () => {
  const globalObject = 'this || self';
  const tree = new ClosureTree({
    sources: [
      'src',
      // For mock module request.
      'path/to/**/*'
    ],
    env: new Environment({
      context: resolveRequest('fixtures', __dirname),
      globalObject
    })
  });

  describe('detect base.js', () => {
    it('other file should not be', () => {
      tree.clear();
      expect(tree.depsfile).to.string;
      const module: any = tree.loadModule(tree.depsfile as string,
        `/*\n` +
        ` * @provideGoog\n` +
        ` */\n` +
        `var goog = goog || {};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.isbase).to.false;
    });

    it('detect by path', () => {
      tree.clear();
      expect(tree.basefile).to.string;
      const module: any = tree.loadModule(tree.basefile as any);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.isbase).to.true;
      expect(module.provides.has('goog')).to.true;
      // Check provide information.
      expect(module.provides.size).to.equal(1);
      const info: any = module.provides.get('goog');
      expect(info).to.exist;
      expect(info.fullname).to.equal('goog');
      expect(info.expr).to.undefined;
      expect(info.statement).to.undefined;
      expect(info.implicities).to.undefined;
      expect(info.id).to.equal('goog');
      expect(info.declaration).to.undefined;
      // Check defines.
      expect(module.defines.get('COMPILED')?.value).to.equal('true');
      expect(module.defines.get('goog.global')?.value).to.equal(globalObject);
      expect(module.defines.get('goog.DEBUG')?.value).to.equal('false');
    });
  });

  describe('detect CommonJS', () => {
    it('detect file extension', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module.cjs', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);
    });

    it('detect typeof for module', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module', `typeof module;\n`);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);
    });

    it('detect expression of require.main, require.cache, module.loaded and module.id', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `if(require.main === module) {};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const isMain = require.main === module;\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `if (require.cache.fs) {};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const loaded = module.loaded;\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `if(module.loaded) {};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const id = module.id;\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `if(typeof module.id === "string") {};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);
    });

    it('detect calling of require', () => {
      let module: any = undefined;

      // Trigger call.
      tree.clear();
      module = tree.loadModule('path/to/module',
        `require("./a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      // Trigger call.
      tree.clear();
      module = tree.loadModule('path/to/module',
        `new (require("./a"));\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      // Trigger call.
      tree.clear();
      module = tree.loadModule('path/to/module',
        `module.require("./a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      // Trigger call.
      tree.clear();
      module = tree.loadModule('path/to/module',
        `new (module.require("./a"));\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      // Trigger new.
      tree.clear();
      module = tree.loadModule('path/to/module',
        `new require("./a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);
    });

    it('detect memberChain and callMemberChain of calling require', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `require("./a").value;\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `module.require("./a").value;\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `require("./a").value();\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `module.require("./a").value();\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);
    });

    it('detect calling of require.resolve', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `require.resolve("./a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `module.require.resolve("./a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `require.resolveWeak("./a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `module.require.resolveWeak("./a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);
    });

    it('detect Webpack HMR in CommonJS module', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `typeof module.hot;\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `if(module.hot) {};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `module.hot.accept("./library.js", function () {})\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.COMMONJS);
    });
  });

  describe('detect ES module', () => {
    it('detect file extension', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module.mjs', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);
    });

    it('detect ImportDeclaration', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module',
        `import * as foo from "foo";\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);
    });

    it('detect ExportDefaultDeclaration', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module',
        `export default function () {}\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);
    });

    it('detect ExportNamedDeclaration', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module',
        `const foo = "";\n` +
        `export {\n` +
        `  foo\n` +
        `};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);
    });

    it('detect ExportAllDeclaration statement', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module',
        `export * from "foo";\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);
    });

    it('detect Webpack HMR in ES module', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `typeof import.meta.webpackHot;\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `if(import.meta.webpackHot) {};\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);

      tree.clear();
      module = tree.loadModule('path/to/module',
        `import.meta.webpackHot.accept("./a.js", function() {});\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.ES);
    });
  });

  describe('detect use Closure', () => {
    it('default not use', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.requires.has('goog')).to.false;
    });

    it('base.js should not use', () => {
      tree.clear();
      const module: any = tree.loadModule(tree.basefile as any, ``);
      expect(tree.errors).to.empty;
      expect(module.isbase).to.true;
      expect(module).to.exist;
      expect(module.requires.has('goog')).to.false;
    });

    it('if has calling of goog API, should use', () => {
      let module: any = undefined;
      let info: any = undefined;

      // Without directives.
      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.module("foo");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.requires.has('goog')).to.true;
      info = module.requires.get('goog');
      expect(info).to.exist;
      expect(info.position).to.equal(0);

      // With directives.
      tree.clear();
      module = tree.loadModule('path/to/module',
        `"use strict";\n` +
        `goog.module("foo");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.requires.has('goog')).to.true;
      info = module.requires.get('goog');
      expect(info).to.exist;
      expect(info.position).to.greaterThan(0);
    });
  });

  describe('parse goog.define', () => {
    it('string value type', () => {
      let module: any = undefined;
      let define: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const name = goog.define("name", "value");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal(`"value"`);
      expect(define.valueType).to.equal('string');

      // In base.js file.
      tree.clear();
      // Mock base.js file.
      module = tree.loadModule(tree.basefile as any,
        `var goog = {};\n` +
        `const name = goog.define("name", "value");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal(`"value"`);
      expect(define.valueType).to.equal('string');
    });

    it('boolean value type', () => {
      let module: any = undefined;
      let define: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const name = goog.define("name", true);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('true');
      expect(define.valueType).to.equal('boolean');

      // In base.js file.
      tree.clear();
      // Mock base.js file.
      module = tree.loadModule(tree.basefile as any,
        `var goog = {};\n` +
        `const name = goog.define("name", true);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('true');
      expect(define.valueType).to.equal('boolean');
    });

    it('number value type', () => {
      let module: any = undefined;
      let define: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const name = goog.define("name", 3);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('3');
      expect(define.valueType).to.equal('number');

      // In base.js file.
      tree.clear();
      // Mock base.js file.
      module = tree.loadModule(tree.basefile as any,
        `var goog = {};\n` +
        `const name = goog.define("name", 3);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('3');
      expect(define.valueType).to.equal('number');
    });

    it('RegExp value type', () => {
      let module: any = undefined;
      let define: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const name = goog.define("name", /123/);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('/123/');
      expect(define.valueType).to.equal('RegExp');

      // In base.js file.
      tree.clear();
      // Mock base.js file.
      module = tree.loadModule(tree.basefile as any,
        `var goog = {};\n` +
        `const name = goog.define("name", /123/);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('/123/');
      expect(define.valueType).to.equal('RegExp');
    });

    it('function value type', () => {
      let module: any = undefined;
      let define: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const name = goog.define("name", function(){});\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('function(){}');
      expect(define.valueType).to.equal('function');

      // In base.js file.
      tree.clear();
      // Mock base.js file.
      module = tree.loadModule(tree.basefile as any,
        `var goog = {};\n` +
        `const name = goog.define("name", function(){});\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('function(){}');
      expect(define.valueType).to.equal('function');
    });

    it('expression value type', () => {
      let module: any = undefined;
      let define: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const name = goog.define("name", a || b);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('a || b');
      expect(define.valueType).to.equal('expression');

      // In base.js file.
      tree.clear();
      // Mock base.js file.
      module = tree.loadModule(tree.basefile as any,
        `var goog = {};\n` +
        `const name = goog.define("name", a || b);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.expr).to.exist;
      expect(define.name).to.equal('name');
      expect(define.value).to.equal('a || b');
      expect(define.valueType).to.equal('expression');
    });

    it('test with defs option', () => {
      let olddefs = tree.env.defs;
      (tree.env as any).defs = new Map();
      (tree.env as any).defs.set('name', 'false');
      (tree.env as any).defs.set('COMPILED', 'false');
      (tree.env as any).defs.set('goog.DEBUG', 'true');

      let module: any = undefined;
      let define: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `const name = goog.define("name", true);\n`
      );
      expect(tree.errors).to.empty;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.value).to.equal('false');

      // In base.js file.
      tree.clear();
      // Mock base.js file.
      module = tree.loadModule(tree.basefile as any,
        `const name = goog.define("name", true);\n` +
        `var COMPILED = false;\n` +
        `goog.DEBUG = goog.define("goog.DEBUG", true);\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      define = module.defines.get('name');
      expect(define).to.exist;
      expect(define.value).to.equal('false');
      // COMPILED force to true.
      define = module.defines.get('COMPILED');
      expect(define).to.exist;
      expect(define.value).to.equal('true');
      // goog.DEBUG forece to false.
      define = module.defines.get('goog.DEBUG');
      expect(define).to.exist;
      expect(define.value).to.equal('false');

      (tree.env as any).defs = olddefs;
    });
  });

  describe('parse dependencies file', () => {
    describe('detect dependencies file', () => {
      it('detect by path', () => {
        tree.clear();
        const module: any = tree.loadModule(tree.depsfile as any, ``);
        expect(module.errors).to.empty;
        expect(module).to.exist;
        expect(module.isdeps).to.true;
      });

      it('only goog.addDependency, should be', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.addDependency("./foo.js", ["foo"], [], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        expect(module.isdeps).to.true;
      });

      it('goog.addDependency with directive, should be', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `'use strict';\n` +
          `goog.addDependency("./foo.js", ["foo"], [], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        expect(module.isdeps).to.true;
      });
    });

    describe('parse goog.addDependency', () => {
      it('goog.addDependency outside dependencies file, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `func();\n` +
          `goog.addDependency("./foo.js", ["foo"], [], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(UnexpectCallingError);
      });

      it('parse goog.addDependency', () => {
        let module: any = undefined;

        // opt_loadFlags with string keys.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.addDependency("./foo.js", ["foo"], ["bar"], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors).to.empty;
        // Find the module and not load it.
        module = (tree as any)._get('foo');
        expect(module).to.exist;
        expect(module.state).to.equal(ModuleState.CACHE);
        expect(module.provides.has('foo')).to.true;
        expect(module.requires.has('bar')).to.true;
        expect(module.lang).to.equal('es6');
        expect(module.type).to.equal(ModuleType.GOOG);

        // opt_loadFlags with identifier keys.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.addDependency("./foo.js", ["foo"], ["bar"], {lang: "es6", module: "goog"});\n`
        );
        expect(tree.errors).to.empty;
        // Find the module and not load it.
        module = (tree as any)._get('foo');
        expect(module).to.exist;
        expect(module.state).to.equal(ModuleState.CACHE);
        expect(module.provides.has('foo')).to.true;
        expect(module.requires.has('bar')).to.true;
        expect(module.lang).to.equal('es6');
        expect(module.type).to.equal(ModuleType.GOOG);
      });

      it('invalid relPath parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.addDependency(null, ["foo"], [], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);
      });

      it('invalid provides parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.addDependency("./foo.js", undefined, [], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.addDependency("./foo.js", [undefined], [], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);
      });

      it('invalid requires parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.addDependency("./foo.js", ["foo"], undefined, {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.addDependency("./foo.js", ["foo"], [undefined], {"lang": "es6", "module": "goog"});\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);
      });

      it('invalid opt_loadFlags parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          // Module value should be string, but get a expression.
          `goog.addDependency("./foo.js", ["foo"], [], {module: ModuleType.GOOG});\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceof(InvalidParameterError);
      });
    });
  });

  describe('parse module', () => {
    describe('parse goog.declareModuleId', () => {
      it('parse goog.declareModuleId', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.declareModuleId("a");\n`
        );
        expect(tree.errors).to.empty;
        expect(module).to.exist;
        expect(module.provides.has('a')).to.true;
        expect(tree.namespaceToRequest.has('a')).to.true;
        // Check provide information.
        const info = module.provides.get('a');
        expect(info).to.exist;
        expect(info.fullname).to.equal('a');
        expect(info.expr).to.exist;
        expect(info.statement).to.exist;
        expect(info.implicities).to.undefined;
        expect(info.id).to.undefined;
        expect(info.declaration).to.undefined;
      });

      it('invalid namespace parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          // namespace parameter missing.
          `goog.declareModuleId();\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(MissingParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          // namespace not string.
          `goog.declareModuleId(something());\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceof(InvalidParameterError);

      });

      it('multi calling of goog.declareModuleId, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.declareModuleId("a");\n` +
          `goog.declareModuleId("b");\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceof(MultiCallingError);
      });
    });

    describe('parse goog.module.declareNamespace', () => {
      it('parse goog.module.declareNamespace', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.module.declareNamespace("a");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        // Has deprecated, should warning.
        expect(tree.warnings.length).to.equal(1);
        expect(tree.warnings[0]).to.instanceOf(DeprecateWarning);
        expect(module.provides.has('a')).to.true;
        expect(tree.namespaceToRequest.has('a')).to.true;
      });

      it('invalid namespace parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          // namespace parameter missing.
          `goog.module.declareNamespace();\n`
        );
        expect(tree.errors).to.not.empty;
        expect(tree.errors[0]).to.instanceof(MissingParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          // namespace parameter not string.
          `goog.module.declareNamespace(something());\n`
        );
        expect(tree.errors).to.not.empty;
        expect(tree.errors[0]).to.instanceof(InvalidParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          // Invalid grammar.
          `goog.module.declareNamespace('~.a');\n`
        );
        expect(tree.errors).to.not.empty;
        expect(tree.errors[0]).to.instanceof(InvalidNamespaceError);
      });

      it('multi calling of goog.module.declareNamespace, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module.declareNamespace("a");\n` +
          `goog.module.declareNamespace("b");\n`
        );
        expect(tree.errors.length).to.equal(1
        );
        expect(tree.errors[0]).to.instanceof(MultiCallingError);
      });
    });

    describe('parse goog.module', () => {
      it('parse goog.module', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.module("a");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.provides.has('a')).to.true;
        expect(module.type).to.equal(ModuleType.GOOG);
      });

      it('multi calling of goog.module, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a")\n` +
          `goog.module('b')\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(MultiCallingError);
      });

      it('goog.module not first statement, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `"use strict";\n` +
          `goog.module("foo");\n`
        );
        expect(tree.errors).to.empty;

        tree.clear();
        tree.loadModule('path/to/module',
          `something();\n` +
          `goog.module("foo");\n`
        );
        expect(tree.errors.length).to.equal(1);
        // @ts-ignore
        expect(tree.errors[0].message.startsWith(
          'goog.module must be first statement at file'
        )).to.true;

        tree.clear();
        tree.loadModule('path/to/module',
          `something();\n` +
          `"use strict";\n` +
          `goog.module("foo");\n`
        );
        expect(tree.errors.length).to.equal(1);
        // @ts-ignore
        expect(tree.errors[0].message.startsWith(
          'goog.module must be first statement at file'
        )).to.true;
      });

      it('invalid module id should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          // name parameter missing.
          `goog.module();\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceof(MissingParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          // name parameter no string.  
          `goog.module(something());\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);
      });

      it('parse declaration of the exported local variable', () => {
        let module: any = undefined;
        let info: any = undefined;

        // Defaults to exports.
        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a');
        expect(info).to.exist;
        expect(info.id).to.equal('exports');
        expect(info.declaration).to.undefined;

        // Undeclared default exports variable.
        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `exports = {};\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a');
        expect(info).to.exist;
        expect(info.id).to.equal('exports');
        expect(info.declaration).to.undefined;

        // Declared default exports variable.
        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `var exports = {};\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a');
        expect(info).to.exist;
        expect(info.id).to.equal('exports');
        expect(info.declaration).to.exist;

        // Declared default exports variable.
        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `const exports = {};\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a');
        expect(info).to.exist;
        expect(info.expr).to.exist;
        expect(info.id).to.equal('exports');
        expect(info.declaration).to.exist;

        // Declared default exports variable.
        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `let exports = {};\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a');
        expect(info).to.exist;
        expect(info.expr).to.exist;
        expect(info.id).to.equal('exports');
        expect(info.declaration).to.exist;
      });
    });

    describe('parse goog.module.declareLegacyNamespace', () => {
      it('parse goog.module.declareLegacyNamespace', () => {
        let module: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.legacy).to.exist;
        expect(module.type).to.equal(ModuleType.GOOG);

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a.b.c");\n` +
          `goog.module.declareLegacyNamespace();\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.legacy).to.exist;
        expect(module.type).to.equal(ModuleType.GOOG);
      });

      it('in legacy GOOG module, provided namespace root conflict with local variable declaration, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `const a = {};\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceConflictError);

        // Without goog.module.declareLegacyNamespace, should ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `const a = {};\n`
        );
        expect(tree.errors).to.empty;
      });

      it('outside GOOG module, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module.declareLegacyNamespace();\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(UnexpectCallingError);

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module.declareLegacyNamespace();\n` +
          `goog.module("foo");\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceof(UnexpectCallingError);
      });
    });
  });

  describe('parse provides', () => {
    describe('parse goog.provide', () => {
      it('parse goog.provide', () => {
        tree.clear();
        const module: any = tree.loadModule('path/to/module',
          `goog.provide("a");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(tree.warnings.length).to.equal(1);
        expect(tree.warnings[0]).to.instanceOf(DeprecateWarning);
        // Check provide information.
        const info = module.provides.get('a');
        expect(info).to.exist;
        expect(info.fullname).to.equal('a');
        expect(info.expr).to.exist;
        expect(info.statement).to.exist;
        expect(info.implicities).to.exist;
        expect(info.id).to.undefined;
      });

      it('parse implicit namespaces of PROVIDE module', () => {
        let module: any = undefined;
        let info: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a.b");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a.b');
        expect(info).to.exist;
        expect(info.implicities).to.deep.equal(['a']);

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a.b");\n` +
          `goog.require("a");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a.b');
        expect(info).to.exist;
        // "a" is required, implicities should be empty.
        expect(info.implicities).to.empty;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `goog.provide("a.b");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a.b');
        expect(info).to.exist;
        // "a" has provided in this module, implicities should be empty.
        expect(info.implicities).to.empty;
      });

      it('parse implicit namespaces of legacy GOOG module', () => {
        let module: any = undefined;
        let info: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `goog.module.declareLegacyNamespace();\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a.b');
        expect(info).to.exist;
        expect(info.implicities).to.deep.equal(['a']);

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a.b");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("a");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.provides.get('a.b');
        expect(info).to.exist;
        // "a" is required, implicities should be empty.
        expect(info.implicities).to.empty;
      });

      it('invalid namespace parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          // name parameter missing.
          `goog.provide();\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(MissingParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          // name parameter not string.
          `goog.provide(something());\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);
      });

      it('provided namespace conflict with local variable declaration, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `const a = {};\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceConflictError);
      });
    });
  });

  describe('parse requires', () => {
    describe('parse goog.require', () => {
      it('parse goog.require and require information', () => {
        let module: any = undefined;
        let info: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `goog.require("b");\n` +
          `const val = b.val;\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.requires.get('b');
        expect(info).to.exist;
        expect(info.confirmed).to.true;
        expect(info.used).to.false;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `const b = goog.require("b");\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        info = module.requires.get('b');
        expect(info).to.exist;
        expect(info.confirmed).to.true;
        // As assignment right operator, used should be true.
        expect(info.used).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.moudle("a");\n` +
          `something(goog.require("b"));\n`
        );
        expect(module).to.exist;
        info = module.requires.get('b');
        expect(info).to.exist;
        expect(info.confirmed).to.true;
        // As parameter, used should be true.
        expect(info.used).to.true;
      });

      it('invalid namespace parameter, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          // namespace parameter missing. 
          `goog.require();\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(MissingParameterError);

        tree.clear();
        tree.loadModule('path/to/module',
          // namespace parameter not string. 
          `goog.require(someting());\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(InvalidParameterError);
      });

      it('manually require Closure library namespace goog, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.require("goog");\n`
        );
        expect(tree.errors.length).to.equal(1);
        // @ts-ignore
        expect(tree.errors[0].message.startsWith(
          `Should not require Closure library namespace goog manually at file`
        )).to.true;
      });

      it('in PROVIDE module, required namespace root conflict with local variable declaration, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `goog.require("b");\n` +
          `const b = {};\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceConflictError);

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.provide("a");` +
          `goog.require("b.c");\n` +
          `const b = {};\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceConflictError);
      });

      it('in legacy GOOG module, required namespace root conflict with local variable declaration, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("b");\n` +
          `const b = something();\n;`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceof(NamespaceConflictError);

        // Without goog.module.declareLegacyNamespace, should ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.require("b");\n` +
          `const b = something();\n;`
        );
        expect(tree.errors).to.empty;
      });

      it('in PROVIDE module, use goog.require expression result, should warning', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `const result = goog.require("b");\n`
        );
        expect(tree.errors).to.empty;
        expect(tree.warnings).to.not.empty;
        expect(tree.warnings.some(warning => warning instanceof BadRequire)).to.true;
      });

      describe('parse memberChain and callMemberChain of goog.require', () => {
        it('in PROVIDE module, should err', () => {
          tree.clear();
          tree.loadModule('path/to/module',
            `goog.provide("a");\n` +
            `goog.require("b").val;\n`
          );
          expect(tree.errors.length).to.equal(1);
          expect(tree.errors[0]).to.instanceOf(BadRequire);

          tree.clear();
          tree.loadModule('path/to/module',
            `goog.provide("a");\n` +
            `goog.require("b").func();\n`
          );
          expect(tree.errors.length).to.equal(1);
          expect(tree.errors[0]).to.instanceOf(BadRequire);
        });
      });
    });
  });

  describe('parse namespae usages', () => {
    it('modify required namespace, should warning', () => {
      tree.clear();
      tree.loadModule('path/to/module',
        `goog.module("a");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `goog.require("b");\n` +
        `b = {};\n` // assign
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings.length).to.equal(1);
      expect(tree.warnings[0]).to.instanceOf(ModifyRequiredNamespaceWarning);

      tree.clear();
      tree.loadModule('path/to/module',
        `goog.module("a");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `goog.require("b");\n` +
        `b.val = {};\n` // assignMemberChain
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings.length).to.equal(1);
      expect(tree.warnings[0]).to.instanceOf(ModifyRequiredNamespaceWarning);

      tree.clear();
      tree.loadModule('path/to/module',
        `goog.provide("a");\n` +
        `goog.require("b");\n` +
        `b = {};\n` // assign
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings).to.not.empty;
      expect(tree.warnings.some(warning => warning instanceof ModifyRequiredNamespaceWarning)).to.true;
    });

    it('in GOOG module, modify implicit namespace, should warning', () => {
      tree.clear();
      tree.loadModule('path/to/module',
        `goog.module("a.b");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `a = {};\n` // assign
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings.length).to.equal(1);
      expect(tree.warnings[0]).to.instanceOf(ModifyImplicitNamespaceWarning);

      tree.clear();
      tree.loadModule('path/to/module',
        `goog.module("a.b");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `a.val = {};\n` // assignMemberChain
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings.length).to.equal(1);
      expect(tree.warnings[0]).to.instanceOf(ModifyImplicitNamespaceWarning);

      tree.clear();
      tree.loadModule('path/to/module',
        `goog.module("other");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `goog.require("a.b");\n` +
        `a = {};\n` // assign
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings.length).to.equal(1);
      expect(tree.warnings[0]).to.instanceOf(ModifyImplicitNamespaceWarning);

      tree.clear();
      tree.loadModule('path/to/module',
        `goog.module("other");\n` +
        `goog.module.declareLegacyNamespace();\n` +
        `goog.require("a.b");\n` +
        `a.val = {};\n` // assignMemberChain
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings.length).to.equal(1);
      expect(tree.warnings[0]).to.instanceOf(ModifyImplicitNamespaceWarning);
    });

    it('in PROVIDE module, modify implicit provided namespace, should warning', () => {
      tree.clear();
      tree.loadModule('path/to/module',
        `goog.provide("a.b");\n` +
        `a = {};\n`
      );
      expect(tree.errors).to.empty;
      expect(tree.warnings).to.not.empty;
      expect(tree.warnings.some(warn => warn instanceof ModifyImplicitNamespaceWarning)).to.true;
    });

    describe('test record namespace usages', () => {
      it('using provided namespcae in GOOG module, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `something(a);\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);
        // In legacy GOOG module, should ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `something(a);\n`
        );
        expect(tree.errors).to.empty;

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `something(a.val);\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);
        // In legacy GOOG module, should ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `something(a.val);\n`
        );
        expect(tree.errors).to.empty;

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `something(a.func());\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);
        // In legacy GOOG module, should ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `something(a.func());\n`
        );
        expect(tree.errors).to.empty;
      });

      it('using required namespcae in legacy GOOG module, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.require("b");\n` +
          `something(b);\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);
        // In legacy GOOG module, shoul ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("b");\n` +
          `something(b);\n`
        );
        expect(tree.errors).to.empty;

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.require("b");\n` +
          `something(b.val);\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);
        // In legacy GOOG module, shoul ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("b");\n` +
          `something(b.val);\n`
        );
        expect(tree.errors).to.empty;

        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.require("b");\n` +
          `something(b.func());\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);
        // In legacy GOOG module, should ok.
        tree.clear();
        tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("b");\n` +
          `something(b.func());\n`
        );
        expect(tree.errors).to.empty;
      });

      it('using required namespace in ES module, should error', () => {
        tree.clear();
        tree.loadModule('path/to/module',
          `import "other";\n` +
          `goog.require("a");\n` +
          `something(a);\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);

        tree.clear();
        tree.loadModule('path/to/module',
          `import "other";\n` +
          `goog.require("a");\n` +
          `something(a.val);\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);

        tree.clear();
        tree.loadModule('path/to/module',
          `import "other";\n` +
          `goog.require("a");\n` +
          `something(a.func());\n`
        );
        expect(tree.errors.length).to.equal(1);
        expect(tree.errors[0]).to.instanceOf(NamespaceOutModuleError);
      });

      it('test record provided namespaces usage in legacy GOOG module', () => {
        let module: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `something(a);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('a')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `something(a.val);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('a')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `something(a.func());\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('a')).to.true;
      });

      it('test record required namespaces usage in legacy GOOG module', () => {
        let module: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("b");\n` +
          `something(b);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('b')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("b");\n` +
          `something(b.val);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('b')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.module("a");\n` +
          `goog.module.declareLegacyNamespace();\n` +
          `goog.require("b");\n` +
          `something(b.func());\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('b')).to.true;
      });

      it('test record provided namespace usages in PROVIDE module', () => {
        let module: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `something(a);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('a')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `something(a.val);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('a')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `something(a.func());\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('a')).to.true;
      });

      it('test record required namespace usages in PROVIDE module', () => {
        let module: any = undefined;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `goog.require("b");\n` +
          `something(b);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('b')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `goog.require("b");\n` +
          `something(b.val);\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('b')).to.true;

        tree.clear();
        module = tree.loadModule('path/to/module',
          `goog.provide("a");\n` +
          `goog.require("b");\n` +
          `something(b.func());\n`
        );
        expect(module).to.exist;
        expect(tree.errors).to.empty;
        expect(module.namespaceUsages.has('b')).to.true;
      });
    });
  });
});
