'use strict';

const { expect } = require('chai');
const { describe, it } = require('mocha');

const Environment = require('../src/Environment');
const ClosureModule = require('../src/closure/ClosureModule');
const ClosureModuleFactory = require('../src//closure/ClosureModuleFactory');
const ClosureTree = require('../src/closure/ClosureTree');
const ModuleState = require('../src/closure/ModuleState');
const ModuleType = require('../src/closure/ModuleType');
const resolveRequest = require('../src/utils/resolveRequest');

const NamespaceConflictError = require('../src/errors/NamespaceConflictError');
const InvalidNamespaceError = require('../src/errors/InvalidNamespaceError');
const NamespaceDuplicateError = require('../src/errors/NamespaceDuplicateError');

describe('Test ClosureModule', () => {
  const env = new Environment({ context: resolveRequest('fixtures', __dirname) });
  const factory = new ClosureModuleFactory();
  const tree = new ClosureTree({
    base: '../../node_modules/google-closure-library/closure/goog/base.js',
    sources: [
      'src',
      // For mock module request.
      'path/to/**/*'
    ],
    env
  });

  // const REQUEST_provide_a = resolveRequest('path/to/provide_a', env.context);
  // const SOURCE_provide_a = `goog.provide("a");\n`;
  // const REQUEST_require_a = resolveRequest('path/to/require_a', env.context);
  // const SOURCE_require_a = `goog.require("a");\n`;

  describe('test constructor', () => {
    it('invalid request throws', () => {
      // If request not string, should throw.
      expect(() => {
        new ClosureModule({ request: undefined });
      }).to.throw('Request must be string.');

      // Glob request should throw.
      const request = '!path/to/module';
      expect(() => {
        new ClosureModule({ request: request });
      }).to.throw(`Request "${request}" must be non glob.`);
    });
  });

  describe('test addProvide', () => {
    it('add invalid namespace grammar, should throw', () => {
      tree.clear();
      const module = tree.loadModule('path/to/module', ``);
      expect(() => {
        module.addProvide('!@#$%');
      }).to.throw(InvalidNamespaceError);
    });

    it('add namespace conflict with builtin object, should throw', () => {
      tree.clear();
      const module = tree.loadModule('path/to/module', ``);
      expect(() => {
        module.addProvide('document');
      }).to.throw(NamespaceConflictError);
    });

    it('add namespace start with goog but not Closure library module, should throw', () => {
      tree.clear();
      // 'path/to/module' is not a Closure library module.
      const module = tree.loadModule('path/to/module', ``);
      expect(() => {
        module.addProvide('goog.wahaha');
      }).to.throw(NamespaceConflictError);
    });

    it('add duplicate, should throw', () => {
      tree.clear();
      const module = tree.loadModule('path/to/module', ``);
      module.addProvide('a');
      expect(module.provides.has('a')).to.true;
      expect(() => {
        module.addProvide('a');
      }).to.throw(NamespaceDuplicateError);
    });
  });

  describe('test addRequire', () => {
    it('test add duplicate', () => {
      let module = undefined;
      const namespace = 'a';
      const oldinfo = { confirmed: undefined };
      const newinfo = { confirmed: undefined };

      // Old provide info confirmed, new provide info unconfirmed, should nothing change.
      tree.clear();
      module = tree.loadModule('path/to/module', ``);
      // Old info confirmed.
      oldinfo.confirmed = true;
      module.addRequire(namespace, oldinfo);
      // Add new uncomfirmed info.
      newinfo.confirmed = false;
      module.addRequire(namespace, newinfo);
      // Info should not change.
      expect(module.requires.get(namespace)).to.equal(oldinfo);

      // Old provide info confirmed, new provide info confirmed, should throw.
      tree.clear();
      module = tree.loadModule('path/to/module', ``);
      // Old info comfirmed.
      oldinfo.confirmed = true;
      module.addRequire(namespace, oldinfo);
      // Add new confirmed info, should throw.
      newinfo.confirmed = true;
      expect(() => {
        module.addRequire(namespace, newinfo);
      }).to.throw(NamespaceDuplicateError);

      // Old provide info unconfirmed, new provide info unconfirmed, nothing change.
      tree.clear();
      module = tree.loadModule('path/to/module', ``);
      // Old info uncomfirmed.
      oldinfo.confirmed = false;
      module.addRequire(namespace, oldinfo);
      // Add new unconfirmed info.
      newinfo.confirmed = false;
      module.addRequire(namespace, newinfo);
      // Info should not change.
      expect(module.requires.get(namespace)).to.equal(oldinfo);

      // Old provide info unconfirmed, new provide info confirmed, should be overwrite.
      tree.clear();
      module = tree.loadModule('path/to/module', ``);
      // Old info comfirmed.
      oldinfo.confirmed = false;
      module.addRequire(namespace, oldinfo);
      // Add new confirmed info.
      newinfo.confirmed = true;
      module.addRequire(namespace, newinfo);
      // Should use new info.
      expect(module.requires.get(namespace)).to.equal(newinfo);
    });
  });

  describe('test getNamespaceInfo', () => {
    it('always return "unknow" outside PROVIDE and legacy GOOG module', () => {
      let type = undefined;

      tree.clear();
      const module = tree.loadModule('path/to/module', `goog.module("a");\n`);
      expect(module.type).to.equal(ModuleType.GOOG);
      expect(module.legacy).to.not.exist;

      type = module.getNamespaceInfo('a.b');
      expect(type.type).to.equal('unknow');
      expect(type.owner).to.equal('a');

      type = module.getNamespaceInfo('other');
      expect(type.type).to.equal('unknow');
      expect(type.owner).to.undefined;
    });

    it('test provided namespace', () => {
      let module = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module', `goog.provide("a");\n`);
      expect(module.getNamespaceInfo('b').type).to.equal('unknow');
      expect(module.getNamespaceInfo('a').type).to.equal('provide');
      expect(module.getNamespaceInfo('a').owner).to.equal('a');
      expect(module.getNamespaceInfo('a.b').type).to.equal('provide');
      expect(module.getNamespaceInfo('a.b').owner).to.equal('a');
      expect(module.getNamespaceInfo('b.a').type).to.equal('unknow');

      tree.clear();
      module = tree.loadModule('path/to/module', `goog.provide("a.b");\n`);
      expect(module.getNamespaceInfo('b').type).to.equal('unknow');
      expect(module.getNamespaceInfo('a').type).to.equal('implicit');
      expect(module.getNamespaceInfo('a').owner).to.equal('a');
      expect(module.getNamespaceInfo('a.b').type).to.equal('provide');
      expect(module.getNamespaceInfo('a.b').owner).to.equal('a.b');
      expect(module.getNamespaceInfo('a.b.c').type).to.equal('provide');
      expect(module.getNamespaceInfo('a.b.c').owner).to.equal('a.b');
      expect(module.getNamespaceInfo('a.c').type).to.equal('implicit');
      expect(module.getNamespaceInfo('a.c').owner).to.equal('a');
    });

    it('test required namespace', () => {
      let module = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.provide("other");\n` +
        `goog.require("a");\n`
      );
      expect(module.getNamespaceInfo('b').type).to.equal('unknow');
      expect(module.getNamespaceInfo('a').type).to.equal('require');
      expect(module.getNamespaceInfo('a').owner).to.equal('a');
      expect(module.getNamespaceInfo('a').type).to.equal('require');
      expect(module.getNamespaceInfo('a').owner).to.equal('a');
      expect(module.getNamespaceInfo('a.b').type).to.equal('require');
      expect(module.getNamespaceInfo('a.b').owner).to.equal('a');
      expect(module.getNamespaceInfo('b.a').type).to.equal('unknow');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.provide("other");\n` +
        `goog.require("a.b");\n`
      );
      expect(module.getNamespaceInfo('b').type).to.equal('unknow');
      expect(module.getNamespaceInfo('a').type).to.equal('implicit');
      expect(module.getNamespaceInfo('a').owner).to.equal('a');
      expect(module.getNamespaceInfo('a.b').type).to.equal('require');
      expect(module.getNamespaceInfo('a.b').owner).to.equal('a.b');
      expect(module.getNamespaceInfo('a.b.c').type).to.equal('require');
      expect(module.getNamespaceInfo('a.b.c').owner).to.equal('a.b');
      expect(module.getNamespaceInfo('a.c').type).to.equal('implicit');
      expect(module.getNamespaceInfo('a.c').owner).to.equal('a');
    });

    it('test mix', () => {
      let module = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a");\n` +
        `goog.provide("a.b");\n`
      );
      expect(module.getNamespaceInfo('a.b.c').type).to.equal('provide');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a.b");\n` +
        `goog.provide("a");\n`
      );
      expect(module.getNamespaceInfo('a.b.c').type).to.equal('require');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a");\n` +
        `goog.provide("a.b.c");\n`
      );
      expect(module.getNamespaceInfo('a.b').type).to.equal('require');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a.b.c");\n` +
        `goog.provide("a");\n`
      );
      expect(module.getNamespaceInfo('a').type).to.equal('provide');
    });
  });

  describe('test load', () => {
    it('load from request', () => {
      tree.clear();

      const module = factory.create('src/provide.js', tree, env);
      module.load();
      expect(module.errors).to.empty;
      expect(module.state === ModuleState.LOAD);
    });

    it('load from source cache', () => {
      tree.clear();

      const module = factory.create('path/to/module', tree, env);
      // Set source cache.
      module.source = `goog.provide("a");\n`;
      module.load();
      expect(module.errors).to.empty;
      expect(module.state).to.equal(ModuleState.LOAD);
    });

    it('load from source', () => {
      tree.clear();

      const module = factory.create('path/to/module', tree, env);
      module.load(`goog.provide("a");\n`);
      expect(module.errors).to.empty;
      expect(module.state).to.equal(ModuleState.LOAD);

      // Load different source, should parse again.
      module.load(`goog.provide("b");\n`);
      expect(module.errors).to.empty;
      expect(module.state).to.equal(ModuleState.LOAD);
    });

    it('load invalid dependency param should error', () => {
      tree.clear();

      const module = factory.create('path/to/module', tree, env);

      // Invalid module flag should error.
      expect(module.errors).to.empty;
      module.load({
        text: ``, // whatever
        relPath: ``, // whatever
        provides: [],
        requires: [],
        flags: {
          module: 'other',
          lang: 'es6'
        }
      });
      expect(module.errors).to.not.empty;

      // Invalid lang flag should throw.
      module.unload();
      expect(module.errors).to.empty;
      module.load({
        text: ``, // whatever
        relPath: ``, // whatever
        provides: [],
        requires: [],
        flags: {
          module: 'goog',
          lang: 'other'
        }
      });
      expect(module.errors).to.not.empty;
    });

    it('load from dependency param', () => {
      tree.clear();

      const module = factory.create('path/to/module', tree, env);
      module.load({
        text: ``, // whatever
        relPath: undefined, // whatever
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

  describe('test unload', () => {
    it('after unload, module should be empty', () => {
      tree.clear();
      const module = tree.loadModule('path/to/module', ``);
      expect(module.state).equal(ModuleState.LOAD);
      module.unload();
      expect(module.state).equal(ModuleState.UNLOAD);
    });
  });
});
