import { expect } from "chai";

import { ClosureTree } from '../src/closure/ClosureTree';
import { ModuleState, ModuleType } from '../src/closure/ClosureModule';
import { Environment } from "../src/Environment";
import { resolveRequest } from '../src/utils/resolveRequest';
import { MatchState } from '../src/source/Sources';

import { CircularReferenceError } from "../src/errors/CircularReferenceError";
import { BadRequire } from '../src/errors/BadRequire';

describe('Test ClosureTree', () => {
  const env = new Environment({
    context: resolveRequest('fixtures', __dirname),
    warningLevel: 'show'
  });
  const tree = new ClosureTree({
    base: '../../node_modules/google-closure-library/closure/goog/base.js',
    sources: [
      'src',
      // For mock module request.
      'path/to/**/*'
    ],
    env
  });

  const REQUEST_provide_a = resolveRequest('path/to/provide_a', env.context);
  const SOURCE_provide_a = `goog.provide('a');\n`;

  describe('test constructor', () => {
    it('with default options', () => {
      const tree = new ClosureTree({
        base: '../../node_modules/google-closure-library/closure/goog/base.js',
        sources: [],
        env
      });
      expect(tree.errors).to.empty;
      expect(tree.libpath).to.exist;
      expect(tree.googpath).to.exist;
      expect(tree.basefile).to.exist;
      expect(tree.depsfile).to.exist;
      // Should not empty.
      expect(tree.requestToModule.size).to.greaterThan(0);
      // Ensure goog is provided.
      expect(tree.namespaceToRequest.has('goog')).to.true;
    });

    it('with sources option', () => {
      const tree = new ClosureTree({
        base: '../../node_modules/google-closure-library/closure/goog/base.js',
        sources: [
          'src'
        ],
        env
      });
      expect(tree.errors).to.empty;
      // User modlules should not empty.
      expect(
        Array.from(tree.requestToModule.entries()).some(pair =>
          tree.isLibraryModule(pair[0]) === false
        )
      ).to.true;
    });
  });

  describe('test check', () => {
    const tree = new ClosureTree({
      base: '../../node_modules/google-closure-library/closure/goog/base.js',
      sources: [
        // For mock module request.
        'path/to/**/*'
      ],
      env
    });

    it('check circular require', () => {
      tree.clear();
      tree.scan();

      // √: a->b->c->d
      expect(tree.errors).to.empty;
      tree.loadModule('path/to/a',
        `goog.provide("a");\n` +
        `goog.require("b");\n`
      );
      expect(tree.errors).to.empty;
      tree.loadModule('path/to/b',
        `goog.provide("b");\n` +
        `goog.require("c");\n`
      );
      expect(tree.errors).to.empty;
      tree.loadModule('path/to/c',
        `goog.provide("c");\n` +
        `goog.require("d");\n`
      );
      expect(tree.errors).to.empty;
      tree.loadModule('path/to/d',
        `goog.provide("d");\n`
      );
      expect(tree.errors).to.empty;

      // x: e-f-g-f
      tree.loadModule('path/to/e',
        `goog.provide("e");\n` +
        `goog.require("f");\n`
      );
      expect(tree.errors).to.empty;
      tree.loadModule('path/to/f',
        `goog.provide("f");\n` +
        `goog.require("g");\n`
      );
      expect(tree.errors).to.empty;
      tree.loadModule('path/to/g',
        `goog.provide("g");\n` +
        `goog.require("f");\n`
      );
      expect(tree.errors).to.empty;

      expect(() => { tree.check(); }).to.throw(CircularReferenceError);
    });

    it('check require self provided namespace', () => {
      tree.clear();
      tree.scan();

      tree.loadModule('path/to/a',
        `goog.provide("a");\n` +
        `goog.provide("a.b");\n` +
        `goog.require("a.b");\n`
      );
      expect(tree.errors).to.empty;

      expect(() => { tree.check(); }).to.throw(BadRequire);
    });

    describe('check unexposed namespace in GOOG module', () => {
      it('if GOOG module not has exposed namespace but connect PROVIDE module, should error', () => {
        tree.clear();
        tree.scan();
        // tree.loadModule('path/to/a',
        const module = tree.loadModule('path/to/a',
          `goog.module("a");\n` +
          `const b = goog.require("b");\n`
        );
        tree.loadModule('path/to/b',
          `goog.module("b");\n` +
          `goog.require("c");\n`
        );
        tree.loadModule('path/to/c',
          `goog.provide("c");\n`
        );
        expect(() => { tree.check(); }).to.throw(BadRequire);

        tree.clear();
        tree.scan();
        tree.loadModule('path/to/a',
          `goog.provide("a");\n` +
          `goog.require("a.b");\n`
        );
        tree.loadModule('path/to/b',
          `goog.module("a.b");\n`
        );
        expect(() => { tree.check(); }).to.throw(BadRequire);
      });
    });
  });

  describe('test deleteModule', () => {
    it('delete invalid request should nothing change', () => {
      tree.clear();
      tree.scan();
      expect(tree.errors).to.empty;
      const treeSize = tree.requestToModule.size;
      expect(treeSize).to.greaterThan(0);

      // Delete non string request.
      tree.deleteModule(undefined as any);
      expect(tree.requestToModule.size).to.equal(treeSize);
      // Delete unmatched request.
      tree.deleteModule('/other/path/to/module');
      expect(tree.requestToModule.size).to.equal(treeSize);
    });
  });

  describe('test getModule', () => {
    it('invalid arg should return null', () => {
      tree.clear();

      expect(tree.getModule(undefined as any)).to.not.exist;
      expect(tree.getModule('a.b.c is not a name')).to.not.exist;
      expect(tree.getModule('src/notExist')).to.not.exist;
    });

    it('get with name', () => {
      tree.clear();

      tree.loadModule(REQUEST_provide_a, SOURCE_provide_a);
      expect(tree.errors).to.empty;
      expect(tree.getModule('a')).to.exist;
    });

    it('get with request', () => {
      tree.clear();

      tree.loadModule(REQUEST_provide_a, SOURCE_provide_a);
      expect(tree.errors).to.empty;
      expect(tree.getModule(REQUEST_provide_a)).to.exist;
    });

    it('get from request will load the unload state module', () => {
      tree.clear();

      const request = 'src/provide.js';

      const module: any = tree.loadModule(request);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      module.unload();
      expect(module.state).to.equal(ModuleState.UNLOAD);
      // Name a should removed.
      expect(tree.namespaceToRequest.has('d')).to.false;
      // Cannot lookup this module from the name.
      expect(tree.getModule('d')).to.not.exist;
      // But module should still in the tree.
      expect(tree.requestToModule.has(module.request)).to.true;
      // Get from the its request.
      expect(tree.getModule(request)).to.exist;
      expect(tree.errors).to.empty;
      // Module should be load state now.
      expect(module.state).to.equal(ModuleState.LOAD);
    });
  });

  describe('test getNamespaceObject', () => {
    it('test construcMissing option', () => {
      tree.clear();

      let namespace: any = tree.getNamespaceObject('a', true);
      expect(namespace).to.exist;
      expect(namespace.name).to.equal('a');
      expect(tree.roots.subs.has('a')).to.true;

      namespace = tree.getNamespaceObject('a.b', true);
      expect(namespace).to.exist;
      expect(namespace.name).to.equal('b');
      expect(tree.roots.subs.get('a')?.subs.has('b')).to.true;

      namespace = tree.getNamespaceObject('a.b.c');
      expect(namespace).to.not.exist;
      expect(tree.roots.subs.get('a')?.subs.get('b')?.subs.has('c')).to.false;

      namespace = tree.getNamespaceObject('a.b.c', true);
      expect(namespace).to.exist;
      expect(tree.roots.subs.get('a')?.subs.get('b')?.subs.has('c')).to.true;

      namespace = tree.getNamespaceObject('other');
      expect(namespace).to.not.exist;
      expect(tree.roots.subs.has('other')).to.false;
    });
  });

  describe('test loadModule', () => {
    it('load from request', () => {
      tree.clear();

      const module: any = tree.loadModule('src/provide.js');
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(tree.namespaceToRequest.has('d')).to.true;
    });

    it('load from source', () => {
      tree.clear();

      const module: any = tree.loadModule(REQUEST_provide_a, SOURCE_provide_a);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(tree.namespaceToRequest.has('a')).to.true;
    });

    it('load from dependency param', () => {
      tree.clear();

      const module: any = tree.loadModule({
        text: '',
        relPath: 'path/to/module',
        provides: ['a'],
        requires: ['b'],
        flags: {
          module: 'goog',
          lang: 'es6'
        }
      });
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.state).to.equal(ModuleState.CACHE);
      expect(module.provides.has('a')).to.true;
      expect(tree.namespaceToRequest.has('a')).to.true;
      expect(module.requires.has('b')).to.true;
      expect(module.type).to.equal(ModuleType.GOOG);
      expect(module.lang).to.equal('es6');
    });
  });

  it('test makeRelPath', () => {
    tree.clear();
    // Rescan to cache goog.math module.
    tree.scan();
    expect(tree.errors).to.empty;
    const module = tree.getModule('goog.math');
    expect(module).to.exist;
    const relRequest = tree.makeRelPath('goog.math')
    expect(relRequest).to.equal('math/math.js');
  });

  describe('test matchRequest', () => {
    it('library module should always include', () => {
      tree.clear();
      expect(tree.basefile).to.string;
      expect(tree.matchRequest(tree.basefile as any)).to.equal(MatchState.INCLUDE);
      expect(tree.depsfile).to.string;
      expect(tree.matchRequest(tree.depsfile as any)).to.equal(MatchState.INCLUDE);
    });
  });
});
