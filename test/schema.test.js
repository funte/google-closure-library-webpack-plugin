const { assert, expect } = require('chai');
const path = require('path');
const GoogleClosureLibraryWebpackPlugin = require('../src/index');

describe('Test schema', function () {
  it('Test defualt option', function () {
    var options = {
      sources: [path.resolve(__dirname, '../examples/goog-declare-example/src')]
    };

    assert.doesNotThrow(function () {
      new GoogleClosureLibraryWebpackPlugin(options);
    }, Error);
  })
});
