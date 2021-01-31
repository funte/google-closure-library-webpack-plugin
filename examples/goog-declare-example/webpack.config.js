const path = require('path');
const HtmlPlugin = require("html-webpack-plugin");
const GCLibraryPlugin = require('google-closure-library-webpack-plugin');

const MODE = process.env.NODE_ENV === 'production' ? 'production' : 'development';

module.exports = {
  mode: MODE,
  devtool: 'cheap-module-source-map',
  entry: {
    'goog-declare-example': './src/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
    library: 'App',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  devServer: {
    contentBase: path.resolve(__dirname, 'build')
  },
  module: {
    rules: [{
      test: /\.html$/,
      use: [{
        loader: "html-loader"
      }]
    }]
  },
  plugins: [
    new GCLibraryPlugin({
      sources: [path.resolve(__dirname, 'src')]
    }),
    new HtmlPlugin({
      chunks: ['goog-declare-example'],
      template: 'index.ejs',
      title: 'goog.declareModuleId example'
    })
  ]
};