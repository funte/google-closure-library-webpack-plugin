'use strict';

const { expect } = require('chai');
const { describe, it } = require('mocha');

const ClosureTree = require('../src/closure/ClosureTree');
const Environment = require('../src/Environment');
const ModuleState = require('../src/closure/ModuleState');
const ModuleType = require('../src/closure/ModuleType');
const resolveRequest = require('../src/utils/resolveRequest');
const { MatchState } = require('../src/source/Sources');

describe('Test ClosureTree', () => {
  const env = new Environment({ context: resolveRequest('fixtures', __dirname) });
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
        env
      });

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
      // User modlules should not empty.
      expect(
        Array.from(tree.requestToModule.entries()).some(pair =>
          tree.isLibraryModule(pair[0]) === false
        )
      ).to.true;
    });
  });

  describe('test deleteModule', () => {
    it('delete invalid request should nothing change', () => {
      tree.clear();
      tree.scan();
      const treeSize = tree.requestToModule.size;
      expect(treeSize).to.greaterThan(0);

      // Delete non string request.
      tree.deleteModule(undefined);
      expect(tree.requestToModule.size).to.equal(treeSize);
      // Delete unmatched request.
      tree.deleteModule('/other/path/to/module');
      expect(tree.requestToModule.size).to.equal(treeSize);
    });
  });

  describe('test getModule', () => {
    it('invalid arg should return null', () => {
      tree.clear();

      expect(tree.getModule(undefined)).to.not.exist;
      expect(tree.getModule('a.b.c is not a name')).to.not.exist;
      expect(tree.getModule('src/notExist')).to.not.exist;
    });

    it('get with name', () => {
      tree.clear();

      tree.loadModule(REQUEST_provide_a, SOURCE_provide_a);
      expect(tree.getModule('a')).to.exist;
    });

    it('get with request', () => {
      tree.clear();

      tree.loadModule(REQUEST_provide_a, SOURCE_provide_a);
      expect(tree.getModule(REQUEST_provide_a)).to.exist;
    });

    it('get from request will load the unload state module', () => {
      tree.clear();

      const request = 'src/provide.js';

      const module = tree.loadModule(request);
      module.unload();
      expect(module.state).to.equal(ModuleState.UNLOAD);
      // Name a should removed.
      expect(tree.namespaceToRequest.has('d')).to.false;
      // Cannot lookup this module from the name.
      expect(tree.getModule('d')).to.not.exist;
      // But bodule should still in the tree.
      expect(tree.requestToModule.has(module.request)).to.true;
      // Get from the its request.
      expect(tree.getModule(request)).to.exist;
      // Module should be load state now.
      expect(module.state).to.equal(ModuleState.LOAD);
    });
  });

  describe('test getNamespace', () => {
    it('test construcMissing option', () => {
      tree.clear();

      let namespace = tree.getNamespace('a', true);
      expect(namespace).to.exist;
      expect(namespace.name).to.equal('a');
      expect(tree.roots.subs.has('a')).to.true;

      namespace = tree.getNamespace('a.b', true);
      expect(namespace).to.exist;
      expect(namespace.name).to.equal('b');
      expect(tree.roots.subs.get('a').subs.has('b')).to.true;

      namespace = tree.getNamespace('a.b.c');
      expect(namespace).to.not.exist;
      expect(tree.roots.subs.get('a').subs.get('b').subs.has('c')).to.false;

      namespace = tree.getNamespace('a.b.c', true);
      expect(namespace).to.exist;
      expect(tree.roots.subs.get('a').subs.get('b').subs.has('c')).to.true;

      namespace = tree.getNamespace('other');
      expect(namespace).to.not.exist;
      expect(tree.roots.subs.has('other')).to.false;
    });
  });

  describe('test loadModule', () => {
    it('load from request', () => {
      tree.clear();

      const module = tree.loadModule('src/provide.js');
      expect(module).to.exist;
      expect(tree.namespaceToRequest.has('d')).to.true;
    });

    it('load from source', () => {
      tree.clear();

      const module = tree.loadModule(REQUEST_provide_a, SOURCE_provide_a);
      expect(module).to.exist;
      expect(tree.namespaceToRequest.has('a')).to.true;
    });

    it('load from dependency param', () => {
      tree.clear();

      const module = tree.loadModule({
        relPath: 'path/to/module',
        provides: ['a'],
        requires: ['b'],
        flags: {
          module: 'goog',
          lang: 'es6'
        }
      });
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
    const module = tree.getModule('goog.math');
    expect(module).to.exist;
    const relRequest = tree.makeRelPath('goog.math')
    expect(relRequest).to.equal('math/math.js');
  });

  describe('test matchRequest', () => {
    it('library module should include', () => {
      tree.clear();
      expect(tree.matchRequest(tree.basefile)).to.equal(MatchState.INCLUDE);
      expect(tree.matchRequest(tree.depsfile)).to.equal(MatchState.INCLUDE);
    });
  });
});
