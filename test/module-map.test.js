const { assert, expect } = require('chai');
const path = require('path');
const GoogleClosureLibraryWebpackPlugin = require('../src/index');
const GoogModuleMap = require('../src/goog-module-map');

function helper_makeModuleMap(options) {
  const plugin = new GoogleClosureLibraryWebpackPlugin(options);
  return new GoogModuleMap(plugin.options);
}

var googDeclareModuleMap;
var googModuleModuleMap;
var googRequireModuleMap;

function helper_setup() {
  googDeclareModuleMap = helper_makeModuleMap({
    sources: [path.resolve(__dirname, '../examples/goog-declare-example/src')]
  });
  googModuleModuleMap = helper_makeModuleMap({
    sources: [path.resolve(__dirname, '../examples/goog-module-example/src')]
  });
  googRequireModuleMap = helper_makeModuleMap({
    sources: [path.resolve(__dirname, '../examples/goog-require-example/src')]
  });
}

function helper_teardown() {
  delete googDeclareModuleMap;
  delete googModuleModuleMap;
  delete googRequireModuleMap;
}

describe('Test module map', function () {
  helper_setup();

  it('Test construct module map', function () {
    assert.notEqual(googDeclareModuleMap.namespace2Path.size, 0);
    assert.notEqual(googDeclareModuleMap.path2Module.size, 0);
    assert.notEqual(googModuleModuleMap.namespace2Path.size, 0);
    assert.notEqual(googModuleModuleMap.path2Module.size, 0);
    assert.notEqual(googRequireModuleMap.namespace2Path.size, 0);
    assert.notEqual(googRequireModuleMap.path2Module.size, 0);
  });

  helper_teardown();
});

describe('Test module data', function () {
  helper_setup();

  it('Test module data', function () {
    var moduleData = null;

    moduleData = googDeclareModuleMap.requireModuleByPath(
      path.resolve(__dirname, '../examples/goog-declare-example/src/index.js')
    );
    assert.exists(moduleData);
    assert.isTrue(moduleData.loaded);
    assert.isTrue(moduleData.isGoogModule);
    assert.equal(googDeclareModuleMap.requireModuleByName('App'), moduleData);
    moduleData = googDeclareModuleMap.requireModuleByPath(
      path.resolve(__dirname, '../examples/goog-declare-example/src/foo.js')
    );
    assert.exists(moduleData);
    assert.isTrue(moduleData.loaded);
    assert.isTrue(moduleData.isGoogModule);
    assert.equal(googDeclareModuleMap.requireModuleByName('Foo'), moduleData);
    moduleData = googDeclareModuleMap.requireModuleByPath(
      path.resolve(__dirname, '../examples/goog-declare-example/src/bar.js')
    );
    assert.exists(moduleData);
    assert.isTrue(moduleData.loaded);
    assert.isTrue(moduleData.isGoogModule);
    assert.equal(googDeclareModuleMap.requireModuleByName('Bar'), moduleData);

    moduleData = googModuleModuleMap.requireModuleByPath(
      path.resolve(__dirname, '../examples/goog-module-example/src/index.js')
    );
    assert.exists(moduleData);
    assert.isTrue(moduleData.loaded);
    assert.isNotTrue(moduleData.isGoogModule);
    moduleData = googModuleModuleMap.requireModuleByPath(
      path.resolve(__dirname, '../examples/goog-module-example/src/foo.js')
    );
    assert.exists(moduleData);
    assert.isTrue(moduleData.loaded);
    assert.isTrue(moduleData.isGoogModule);
    assert.equal(googModuleModuleMap.requireModuleByName('Foo'), moduleData);

    moduleData = googRequireModuleMap.requireModuleByPath(
      path.resolve(__dirname, '../examples/goog-require-example/src/index.js')
    );
    assert.exists(moduleData);
    assert.isTrue(moduleData.loaded);
    assert.isNotTrue(moduleData.isGoogModule);
    moduleData = googRequireModuleMap.requireModuleByPath(
      path.resolve(__dirname, '../examples/goog-require-example/src/foo.js')
    );
    assert.exists(moduleData);
    assert.isTrue(moduleData.loaded);
    assert.isNotTrue(moduleData.isGoogModule);
    assert.equal(googRequireModuleMap.requireModuleByName('Foo'), moduleData);
  });

  helper_teardown();
});
