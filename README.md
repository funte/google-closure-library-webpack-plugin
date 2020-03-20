# google-closure-library-webpack-plugin
Make webpack recognize `goog.require, goog.provide, goog.module`, seprate from [closure-webpack-plugin](https://github.com/webpack-contrib/closure-webpack-plugin).
Work with [google-closure-deps-webpack-plugin](https://www.npmjs.com/package/google-closure-deps-webpack-plugin).

<b>Note</b>: this plugin donnot compile your code, there is no java or JS version Google-Closure-Compier working in it. 

## usage
Case these files in your project are written with Google Closure:  
```js
// <your project>/src/hello.js
goog.require('goog.dom');
goog.require('goog.dom.TagName');

var ele = goog.dom.createDom(goog.dom.TagName.P, {}, "hello world!!");

export { ele };
```
```js
// <your project>/src/index.js
import {ele} from './lib/hello.js';

document.body.append(ele);

```

Config webpack with:
```js
const GCLibraryPlugin = require('google-closure-library-webpack-plugin');
const GCDepsPlugin = require('google-closure-deps-webpack-plugin');

module.exports = {
  // ...
  plugins: [
      new GCDepsPlugin({
        output: '.tmp/deps.js',
        source: {
          roots: ['src'],
        },
        goog: 'node_modules/google-closure-library/closure/goog/base.js',
        python: 'python'
      }),
      new GCLibraryPlugin({
        closureLibraryBase: require.resolve(
          'google-closure-library/closure/goog/base'
        ),
        deps: [
          require.resolve('google-closure-library/closure/goog/deps'),
          // path for generated depenencies file.
          '.tmp/deps.js',
        ],
      })
    ]
}
```

## example
- [template-closure-webpack-plugin-2](https://github.com/funte/template-closure-webpack-plugin-2)  
  Use plugins `google-closure-deps-webpack-plugin` and `google-closure-library-webpack-plugin` support [Closure Library](https://developers.google.com/closure/library) in webpack.  

More visit https://developers.google.com/closure/library.  