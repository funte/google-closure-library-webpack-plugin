const { assert, expect } = require('chai');
const path = require('path');
const GoogleClosureLibraryWebpackPlugin = require('../src/index');
const { ModuleTag, GoogModuleData, GoogModuleMap } = require('../src/goog-module-map');

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

describe('Test module data', function () {
  it('Test tag', function () {
    let moduleData = new GoogModuleData('');

    moduleData.tag = ModuleTag.LIB;
    assert.isOk(moduleData.isTag(ModuleTag.LIB));
    assert.isNotOk(moduleData.isTag(ModuleTag.DEFAULT));
    assert.isNotOk(moduleData.isTag(ModuleTag.USER_ALL));

    moduleData.tag = ModuleTag.DEFAULT;
    assert.isNotOk(moduleData.isTag(ModuleTag.LIB));
    assert.isOk(moduleData.isTag(ModuleTag.DEFAULT));
    assert.isOk(moduleData.isTag(ModuleTag.USER_ALL));

    const userDefinedTag = 'userDefinedTag';
    moduleData.tag = userDefinedTag;
    assert.isNotOk(moduleData.isTag(ModuleTag.LIB));
    assert.isNotOk(moduleData.isTag(ModuleTag.DEFAULT));
    assert.isOk(moduleData.isTag(ModuleTag.USER_ALL));
    assert.isOk(moduleData.isTag(userDefinedTag));
  });
});

describe('Test module map', function () {
  helper_setup();

  it('Test construct module map', function () {
    assert.notEqual(googDeclareModuleMap._namespace2Path.size, 0);
    assert.notEqual(googDeclareModuleMap._path2Module.size, 0);
    assert.notEqual(googModuleModuleMap._namespace2Path.size, 0);
    assert.notEqual(googModuleModuleMap._path2Module.size, 0);
    assert.notEqual(googRequireModuleMap._namespace2Path.size, 0);
    assert.notEqual(googRequireModuleMap._path2Module.size, 0);
  });

  it('Test require module', function () {
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

  it('Test load deps file', function () {
    // TODO: Test load deps file
  });

  it('Test write deps file', function () {
    // TODO: Test write deps file
  });

  it('Test scan modules', function () {
    // TODO: Test scan modules
  });

  it('Test \"has\"', function () {
    // TODO: Test \"has\"
  })

  it('Test update modules', function () {
    // TODO: Test update modules
  });

  it('Test delete modules', function () {
    // TODO: Test delete modules
  });

  it('Test find modules', function () {
    // TODO: Test find modules
  });

  it('Test reload module', function () {
    // TODO: Test reload module
  });

  it('Test load module', function () {
    // TODO: Test load module
  });

  helper_teardown();
});
