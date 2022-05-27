const path = require('path');
const { GoogleClosureLibraryWebpackPlugin } = require('google-closure-library-webpack-plugin');
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    bundle: {
      import: path.resolve(__dirname, 'src/index.js'),
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
  plugins: [
    new GoogleClosureLibraryWebpackPlugin({
      base: './node_modules/google-closure-library/closure/goog/base.js',
      sources: [
        path.resolve(__dirname, 'src/*.js')
      ],
      debug: {
        logTransformed: true
      }
    }),
    new HtmlWebpackPlugin({
      chunks: ['bundle'],
      template: path.resolve(__dirname, 'src/index.ejs'),
      filename: 'index.html',
      title: 'goog.module example'
    })
  ],
  stats: {
    children: true
  }
};
