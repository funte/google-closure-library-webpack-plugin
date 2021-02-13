const { assert, expect } = require('chai');
const path = require('path');
const FileContext = require('../../src/util/file-context');

describe('Test file context', function () {
  it('Test constructor', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ]);

    assert.equal(filesContext.scan().length, 3);
  });

  it('Test directory', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src')
    ]);

    assert.equal(filesContext.scan().length, 3);
  });

  it('Test with exclude files', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ], [
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js')
    ]);

    assert.equal(filesContext.scan().length, 2);
  });

  it('Test directory with exclude files', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src')
    ], [
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js')
    ]);

    assert.equal(filesContext.scan().length, 2);
  });

  it('Test with exclude directory', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ], [
      path.resolve(__dirname, '../../examples/goog-declare-example/src')
    ]);

    assert.equal(filesContext.scan().length, 0);
  });

  it('Test directory with exclude directory', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src')
    ], [
      path.resolve(__dirname, '../../examples/goog-declare-example/src')
    ]);

    assert.equal(filesContext.scan().length, 0);
  });

  it('Test \"filesToWatch\"', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ]);

    assert.equal(filesContext.filesToWatch().length, 3);
  });

  it('Test \"directoriesToWatch\"', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src')
    ]);

    assert.equal(filesContext.directoriesToWatch().length, 1);
  });

  it('Test \"filter\"', function () {
    var filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js'),
      path.resolve(__dirname, '../../examples/goog-module-example/src')
    ], [
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ]);

    assert.isOk(filesContext.filter(
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js')
    ));
    assert.isNotOk(filesContext.filter(
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ));
    assert.isOk(filesContext.filter(
      path.resolve(__dirname, '../../examples/goog-module-example/src/index.js')
    ));
    assert.isNotOk(filesContext.filter(
      path.resolve(__dirname, '../../examples/goog-require-example/src/index.js')
    ));
  });
});
