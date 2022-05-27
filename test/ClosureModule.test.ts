import { expect } from 'chai';

import { Environment } from '../src/Environment';
import { ClosureModule, ModuleState, ModuleType } from '../src/closure/ClosureModule';
import { ClosureModuleFactory } from '../src/closure/ClosureModuleFactory';
import { ClosureTree } from '../src/closure/ClosureTree';
import { resolveRequest } from '../src/utils/resolveRequest';

import { NamespaceConflictError } from '../src/errors/NamespaceConflictError';
import { InvalidNamespaceError } from '../src/errors/InvalidNamespaceError';
import { NamespaceDuplicateError } from '../src/errors/NamespaceDuplicateError';

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

  describe('test constructor', () => {
    it('invalid request throws', () => {
      // If request not string, should throw.
      expect(() => {
        new ClosureModule({ request: undefined } as any);
      }).to.throw('Request must be string.');

      // Glob request should throw.
      const request = '!path/to/module';
      expect(() => {
        new ClosureModule({ request: request } as any);
      }).to.throw(`Request "${request}" must be non glob.`);
    });
  });

  describe('test addProvide', () => {
    it('add invalid namespace grammar, should throw', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(() => {
        module.addProvide('!@#$%');
      }).to.throw(InvalidNamespaceError);
    });

    it('add namespace conflict with builtin object, should throw', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(() => {
        module.addProvide('document');
      }).to.throw(NamespaceConflictError);
    });

    it('add namespace start with goog but not Closure library module, should throw', () => {
      tree.clear();
      // 'path/to/module' is not a Closure library module.
      const module: any = tree.loadModule('path/to/module', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(() => {
        module.addProvide('goog.wahaha');
      }).to.throw(NamespaceConflictError);
    });

    it('add duplicate, should throw', () => {
      tree.clear();
      const module: any = tree.loadModule('path/to/module', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      module.addProvide('a');
      expect(module.provides.has('a')).to.true;
      expect(() => {
        module.addProvide('a');
      }).to.throw(NamespaceDuplicateError);
    });
  });

  describe('test addRequire', () => {
    it('test add duplicate', () => {
      let module: any = undefined;
      const namespace = 'a';
      const oldinfo: any = { confirmed: undefined };
      const newinfo: any = { confirmed: undefined };

      // Old provide info confirmed, new provide info unconfirmed, should nothing change.
      tree.clear();
      module = tree.loadModule('path/to/module', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
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
      expect(tree.errors).to.empty;
      expect(module).to.exist;
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
      expect(tree.errors).to.empty;
      expect(module).to.exist;
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
      expect(tree.errors).to.empty;
      expect(module).to.exist;
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

  describe('test getNamespaceType', () => {
    it('always return "unknow" outside PROVIDE and legacy GOOG module', () => {
      let type: any = undefined;

      tree.clear();
      const module: any = tree.loadModule('path/to/module', `goog.module("a");\n`);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.type).to.equal(ModuleType.GOOG);
      expect(module.legacy).to.not.exist;

      type = module.getNamespaceType('a.b');
      expect(type.type).to.equal('unknow');
      expect(type.owner).to.equal('a');

      type = module.getNamespaceType('other');
      expect(type.type).to.equal('unknow');
      expect(type.owner).to.undefined;
    });

    it('test provided namespace', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module', `goog.provide("a");\n`);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('b').type).to.equal('unknow');
      expect(module.getNamespaceType('a').type).to.equal('provide');
      expect(module.getNamespaceType('a').owner).to.equal('a');
      expect(module.getNamespaceType('a.b').type).to.equal('provide');
      expect(module.getNamespaceType('a.b').owner).to.equal('a');
      expect(module.getNamespaceType('b.a').type).to.equal('unknow');

      tree.clear();
      module = tree.loadModule('path/to/module', `goog.provide("a.b");\n`);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('b').type).to.equal('unknow');
      expect(module.getNamespaceType('a').type).to.equal('implicit');
      expect(module.getNamespaceType('a').owner).to.equal('a');
      expect(module.getNamespaceType('a.b').type).to.equal('provide');
      expect(module.getNamespaceType('a.b').owner).to.equal('a.b');
      expect(module.getNamespaceType('a.b.c').type).to.equal('provide');
      expect(module.getNamespaceType('a.b.c').owner).to.equal('a.b');
      expect(module.getNamespaceType('a.c').type).to.equal('implicit');
      expect(module.getNamespaceType('a.c').owner).to.equal('a');
    });

    it('test required namespace', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.provide("other");\n` +
        `goog.require("a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('b').type).to.equal('unknow');
      expect(module.getNamespaceType('a').type).to.equal('require');
      expect(module.getNamespaceType('a').owner).to.equal('a');
      expect(module.getNamespaceType('a').type).to.equal('require');
      expect(module.getNamespaceType('a').owner).to.equal('a');
      expect(module.getNamespaceType('a.b').type).to.equal('require');
      expect(module.getNamespaceType('a.b').owner).to.equal('a');
      expect(module.getNamespaceType('b.a').type).to.equal('unknow');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.provide("other");\n` +
        `goog.require("a.b");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('b').type).to.equal('unknow');
      expect(module.getNamespaceType('a').type).to.equal('implicit');
      expect(module.getNamespaceType('a').owner).to.equal('a');
      expect(module.getNamespaceType('a.b').type).to.equal('require');
      expect(module.getNamespaceType('a.b').owner).to.equal('a.b');
      expect(module.getNamespaceType('a.b.c').type).to.equal('require');
      expect(module.getNamespaceType('a.b.c').owner).to.equal('a.b');
      expect(module.getNamespaceType('a.c').type).to.equal('implicit');
      expect(module.getNamespaceType('a.c').owner).to.equal('a');
    });

    it('test mix', () => {
      let module: any = undefined;

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a");\n` +
        `goog.provide("a.b");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('a.b.c').type).to.equal('provide');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a.b");\n` +
        `goog.provide("a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('a.b.c').type).to.equal('require');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a");\n` +
        `goog.provide("a.b.c");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('a.b').type).to.equal('require');

      tree.clear();
      module = tree.loadModule('path/to/module',
        `goog.require("a.b.c");\n` +
        `goog.provide("a");\n`
      );
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.getNamespaceType('a').type).to.equal('provide');
    });
  });

  describe('test load', () => {
    it('load from request', () => {
      tree.clear();

      const module: any = factory.create('src/provide.js', tree, env);
      expect(factory.errors).to.empty;
      expect(module).to.exist;
      module.load();
      expect(module.errors).to.empty;
      expect(module.state === ModuleState.LOAD);
    });

    it('load from source cache', () => {
      tree.clear();

      const module: any = factory.create('path/to/module', tree, env);
      expect(factory.errors).to.empty;
      expect(module).to.exist;
      // Set source cache.
      module.source = `goog.provide("a");\n`;
      module.load();
      expect(module.errors).to.empty;
      expect(module.state).to.equal(ModuleState.LOAD);
    });

    it('load from source', () => {
      tree.clear();

      const module: any = factory.create('path/to/module', tree, env);
      expect(factory.errors).to.empty;
      expect(module).to.exist;
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

      const module: any = factory.create('path/to/module', tree, env);
      expect(factory.errors).to.empty;
      expect(module).to.exist;

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

      const module: any = factory.create('path/to/module', tree, env);
      expect(factory.errors).to.empty;
      expect(module).to.exist;
      module.load({
        text: ``, // whatever
        relPath: '', // whatever
        provides: ['a'],
        requires: ['b'],
        flags: {
          module: 'goog',
          lang: 'es6'
        }
      });
      expect(module.errors).to.empty;
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
      const module: any = tree.loadModule('path/to/module', ``);
      expect(tree.errors).to.empty;
      expect(module).to.exist;
      expect(module.state).equal(ModuleState.LOAD);
      module.unload();
      expect(module.state).equal(ModuleState.UNLOAD);
      expect(module.isbase).to.false;
      expect(module.isdeps).to.false;
      expect(module.type).to.equal(ModuleType.SCRIPT);
      expect(module.legacy).to.undefined;
      expect(module.lang).to.equal('es3');
      expect(module.provides).to.empty;
      expect(module.requires).to.empty;
      expect(module.namespaceUsages).to.empty;
      expect(module.namespaceTypes).to.empty;
      expect(module.defines).to.empty;
    });
  });
});
