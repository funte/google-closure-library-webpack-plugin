const { assert, expect } = require('chai');
const path = require('path');
const { createFsFromVolume, Volume } = require('memfs');
const webpack = require('webpack');

describe('Test goog require parser plugin', function () {
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

  it('Test pack goog-declare-example', async () => {
    const option = require('../examples/goog-declare-example/webpack.config');
    option.context = path.resolve(__dirname, '../examples/goog-declare-example');
    const stats = await helper_compile(option);

    assert.equal(stats.compilation.errors.length, 0);
    const fs = stats.compilation.compiler.outputFileSystem;
    assert.isTrue(fs.existsSync(path.resolve(stats.compilation.compiler.outputPath, 'index.js')));
    // TODO: test bundle file.
  });

  it('Test pack goog-module-example', async () => {
    const option = require('../examples/goog-module-example/webpack.config');
    option.context = path.resolve(__dirname, '../examples/goog-module-example');
    const stats = await helper_compile(option);

    assert.equal(stats.compilation.errors.length, 0);
    const fs = stats.compilation.compiler.outputFileSystem;
    assert.isTrue(fs.existsSync(path.resolve(stats.compilation.compiler.outputPath, 'index.js')));
    // TODO: test bundle file.
  });

  it('Test pack goog-require-example', async () => {
    const option = require('../examples/goog-require-example/webpack.config');
    option.context = path.resolve(__dirname, '../examples/goog-require-example');
    const stats = await helper_compile(option);

    assert.equal(stats.compilation.errors.length, 0);
    const fs = stats.compilation.compiler.outputFileSystem;
    assert.isTrue(fs.existsSync(path.resolve(stats.compilation.compiler.outputPath, 'index.js')));
    // TODO: test bundle file.
  });
});
