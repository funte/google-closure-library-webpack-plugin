const { assert, expect } = require('chai');
const path = require('path');
const { FileCache, FileContext } = require('../../src/util/file-context');

describe('Test file cache', function () {
  it('Test \"hit\"', function () {
    var cache = new FileCache();
    cache.addFile(path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js'));
    cache.addDir(path.resolve(__dirname, '../../examples/goog-module-example/src/'));

    assert.isOk(cache.has(
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ));
    assert.isOk(cache.has(
      path.resolve(__dirname, '../../examples/goog-module-example/src')
    ));
    assert.isOk(cache.has(
      path.resolve(__dirname, '../../examples/goog-module-example/src/index.js')
    ));
    assert.isNotOk(cache.has(
      path.resolve(__dirname, '../../examples/goog-require-example/src/index.js')
    ));
    assert.isNotOk(cache.has(
      path.resolve(__dirname, '../../examples/goog-require-example/src')
    ));
  });

  it('Test \"shrink\"', function () {
    var cache = new FileCache();
    cache.addFile(path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js'));
    cache.addFile(path.resolve(__dirname, '../../examples/goog-module-example/src/index.js')); // Unnecessary.
    cache.addDir(path.resolve(__dirname, '../../examples/goog-module-example/'));
    cache.addDir(path.resolve(__dirname, '../../examples/goog-module-example/src/')); // Unnecessary.

    cache.shrink();
    assert.equal(Array.from(cache._files).length, 1);
    assert.equal(Array.from(cache._dirs).length, 1);
  });
});

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

    assert.isOk(filesContext.has(
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js')
    ));
    assert.isNotOk(filesContext.has(
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js')
    ));
    assert.isOk(filesContext.has(
      path.resolve(__dirname, '../../examples/goog-module-example/src/index.js')
    ));
    assert.isNotOk(filesContext.has(
      path.resolve(__dirname, '../../examples/goog-require-example/src/index.js')
    ));
  });

  it('Test \"include\"', function () {
    var filesContext;
    var oldIncludeFilesCount;
    var oldIncludeDirsCount

    // Include new files and directories.
    filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js'),
      path.resolve(__dirname, '../../examples/goog-module-example/src')
    ], [
      path.resolve(__dirname, '../../examples/goog-require-example/src')
    ]);
    oldIncludeFilesCount = filesContext.includes.files().length;
    oldIncludeDirsCount = filesContext.includes.dirs().length;
    filesContext.include([
      // Include one new file.
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js')
    ]);
    assert.equal(filesContext.includes.files().length, oldIncludeFilesCount + 1);
    oldIncludeFilesCount = filesContext.includes.files().length;
    oldIncludeDirsCount = filesContext.includes.dirs().length;
    filesContext.include([
      // Include one new directory.
      path.resolve(__dirname)
    ]);
    assert.equal(filesContext.includes.dirs().length, oldIncludeDirsCount + 1);

    // Include include files and directories.
    filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js'),
      path.resolve(__dirname, '../../examples/goog-module-example/src')
    ], [
      path.resolve(__dirname, '../../examples/goog-require-example/src')
    ]);
    oldIncludeFilesCount = filesContext.includes.files().length;
    oldIncludeDirsCount = filesContext.includes.dirs().length;
    filesContext.include([
      // File already include.
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      // Directory already include.
      path.resolve(__dirname, '../../examples/goog-module-example/src')
    ]);
    // Include cache not change.
    assert.equal(filesContext.includes.files().length, oldIncludeFilesCount);
    assert.equal(filesContext.includes.dirs().length, oldIncludeDirsCount);

    // Include exclude files and directories.
    filesContext = new FileContext([
      path.resolve(__dirname, '../../examples/goog-declare-example/src/bar.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/foo.js'),
      path.resolve(__dirname, '../../examples/goog-declare-example/src/index.js'),
      path.resolve(__dirname, '../../examples/goog-module-example/src')
    ], [
      path.resolve(__dirname, '../../examples/goog-require-example/src')
    ]);
    oldIncludeFilesCount = filesContext.includes.files().length;
    oldIncludeDirsCount = filesContext.includes.dirs().length;
    filesContext.include([
      // File exclude.
      path.resolve(__dirname, '../../examples/goog-require-example/src/index.js'),
      // Directory exclude.
      path.resolve(__dirname, '../../examples/goog-require-example/src')
    ]);
    // Include cache not change.
    assert.equal(filesContext.includes.files().length, oldIncludeFilesCount);
    assert.equal(filesContext.includes.dirs().length, oldIncludeDirsCount);
  })
});
