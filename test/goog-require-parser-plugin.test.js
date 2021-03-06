const { assert, expect } = require('chai');
const path = require('path');
const { createFsFromVolume, Volume } = require('memfs');
const webpack = require('webpack');

// How test webpack in memory? See:
//  1. https://github.com/webpack/webpack/blob/master/test/Stats.test.js 
//  2. https://stackoverflow.com/questions/38779924/compiling-webpack-in-memory-but-resolving-to-node-modules-on-disk

describe('Test \"GoogRequireParserPlugin\"', function () {
  const helper_compile = (options) => {
    return new Promise((resolve, reject) => {
      const compiler = webpack(options);
      const fs = createFsFromVolume(new Volume());
      fs.join = path.join;
      compiler.outputFileSystem = fs;
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats);
        }
      });
    });
  };

  it('Test build goog-declare-example', async () => {
    const option = require('../examples/goog-declare-example/webpack.config');
    option.context = path.resolve(__dirname, '../examples/goog-declare-example');
    const stats = await helper_compile(option);

    assert.equal(stats.compilation.errors.length, 0, "Compilation error");
    const fs = stats.compilation.compiler.outputFileSystem;
    assert.isTrue(fs.existsSync(path.resolve(stats.compilation.compiler.outputPath, 'goog-declare-example.js')));
    // TODO: test bundle file.
  });

  it('Test build goog-module-example', async () => {
    const option = require('../examples/goog-module-example/webpack.config');
    option.context = path.resolve(__dirname, '../examples/goog-module-example');
    const stats = await helper_compile(option);

    assert.equal(stats.compilation.errors.length, 0, "Compilation error");
    const fs = stats.compilation.compiler.outputFileSystem;
    assert.isTrue(fs.existsSync(path.resolve(stats.compilation.compiler.outputPath, 'goog-module-example.js')));
    // TODO: test bundle file.
  });

  it('Test build goog-require-example', async () => {
    const option = require('../examples/goog-require-example/webpack.config');
    option.context = path.resolve(__dirname, '../examples/goog-require-example');
    const stats = await helper_compile(option);

    assert.equal(stats.compilation.errors.length, 0, "Compilation error");
    const fs = stats.compilation.compiler.outputFileSystem;
    assert.isTrue(fs.existsSync(path.resolve(stats.compilation.compiler.outputPath, 'goog-require-example.js')));
    // TODO: test bundle file.
  });
});
