const { assert, expect } = require('chai');
const path = require('path');
const scanSource = require('../src/scan-source');

describe('Test scan source file', function () {
  it('Test default', function () {
    var files = scanSource();
    assert.equal(files.size, 0);
  });

  it('Test flat source files', function () {
    var files = scanSource([
      path.resolve(__dirname, '../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/index.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/non-exist.js')
    ]);

    assert.equal(files.size, 3);
  });

  it('Test directory', function () {
    var files = scanSource([
      path.resolve(__dirname, '../examples/goog-declare-example/src'),
      path.resolve(__dirname, '../examples/goog-declare-example/non-exist')
    ]);

    assert.equal(files.size, 3);
  });

  it('Test flat source files with exclude files', function () {
    var files = scanSource([
      path.resolve(__dirname, '../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/index.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/non-exist.js')
    ], [
      path.resolve(__dirname, '../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/non-exist.js')
    ]);

    assert.equal(files.size, 2);
  });

  it('Test directory source with exclude files', function () {
    var files = scanSource([
      path.resolve(__dirname, '../examples/goog-declare-example/src'),
      path.resolve(__dirname, '../examples/goog-declare-example/non-exist')
    ], [
      path.resolve(__dirname, '../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/non-exist.js')
    ]);

    assert.equal(files.size, 2);
  });

  it('Test flat source files with exclude directory', function () {
    var files = scanSource([
      path.resolve(__dirname, '../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/index.js'),
      path.resolve(__dirname, '../examples/goog-declare-example/src/non-exist.js')
    ], [
      path.resolve(__dirname, '../examples/goog-declare-example/src'),
      path.resolve(__dirname, '../examples/goog-declare-example/non-exists')
    ]);

    assert.equal(files.size, 0);
  });

  it('Test directory source with exclude directory', function () {
    var files = scanSource([
      path.resolve(__dirname, '../examples/goog-declare-example/src'),
      path.resolve(__dirname, '../examples/goog-declare-example/non-exist')
    ], [
      path.resolve(__dirname, '../examples/goog-declare-example/src'),
      path.resolve(__dirname, '../examples/goog-declare-example/non-exists')
    ]);

    assert.equal(files.size, 0);
  });
});
