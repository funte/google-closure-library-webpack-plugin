const fs = require('fs-extra');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require('path');
const pig = require('slim-pig');
const ConstDependency = require('webpack/lib/dependencies/ConstDependency');

// Transformed base.js file path.
const base = pig.pattern.resolvePattern('closure/closure/goog/base.js', __dirname);
if (!fs.existsSync(base)) {
  throw new Error(`Transformed base.js file not exists, maybe you forget run the generate command "yarn gen".`);
}
// See https://github.com/funte/google-closure-library-webpack-plugin/blob/92613e0a71e327be4247ac9633305afd6c8a44b6/src/Plugin.ts#L111
const PLUGIN_NAME = 'PatchBasefilePugin';
class PatchBasefilePugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      const parserHandler = (parser, options) => {
        /** @type {[number, number][]} */
        const toplevelThisRanges = [];
        parser.hooks.program.tap(PLUGIN_NAME, () => {
          toplevelThisRanges.length = 0;
        });
        parser.hooks.expression.for('this').tap(PLUGIN_NAME, node => {
          if (node.range) {
            toplevelThisRanges.push(node.range);
          }
        });
        parser.hooks.finish.tap(PLUGIN_NAME, () => {
          const module = parser.state.current;
          if (!pig.fs.isSameDirectory(base, module.resource)) { return; }
          if (!module.presentationalDependencies
            || module.presentationalDependencies.length === 0
            || toplevelThisRanges.length === 0
          ) { return; }

          let found = true;
          while (found) {
            found = false;
            for (let i = 0; i < module.presentationalDependencies.length; i++) {
              const dependency = module.presentationalDependencies[i];
              if (dependency instanceof ConstDependency
                && toplevelThisRanges.includes(dependency.range)
              ) {
                module.presentationalDependencies.splice(i, 1);
                found = true;
                break;
              }
            }
          }
        });
      };
      normalModuleFactory.hooks.parser
        .for('javascript/auto')
        .tap(PLUGIN_NAME, parserHandler);
      normalModuleFactory.hooks.parser
        .for('javascript/dynamic')
        .tap(PLUGIN_NAME, parserHandler);
      normalModuleFactory.hooks.parser
        .for('javascript/esm')
        .tap(PLUGIN_NAME, parserHandler);
    });
  }
}

module.exports = {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    bundle: {
      import: path.resolve(__dirname, './src/index.ts'),
      library: {
        name: 'App',
        type: 'umd'
      }
    }
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    globalObject: `(this || self)`
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [{
      test: /\.ts$/,
      loader: 'ts-loader'
    }, {
      test: /\.html$/,
      use: [{
        loader: "html-loader"
      }]
    }]
  },
  plugins: [
    new PatchBasefilePugin(),
    new HtmlWebpackPlugin({
      chunks: ['bundle'],
      template: 'src/index.ejs',
      filename: 'index.html',
      title: 'exprements.typescript'
    })
  ]
};
