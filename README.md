# google-closure-library-webpack-plugin
Webpack plugin for google-closure-library, separate from [closure-webpack-plugin](https://www.npmjs.com/package/closure-webpack-plugin).  
Make webpack recognize `goog.require, goog.provide, goog.module, goog.declareModuleId`.
This plugin just transform the closure file to compatible webpack bundle, no need to install Google-Closure-Compiler.  
Currently support `google-closure-library@20200830.0.0, webpack@4.42.0`.

## Install
```sh
npm install google-closure-library-webpack-plugin --save-dev
```
## Examples
- [goog-declare-example](examples/goog-declare-example/README.md)  
Using `goog.declare` show how make cross reference between ES6 and goog module.  
- [goog-module-example](examples/goog-module-example/README.md)  
Import the goog module defined by `goog.module`.  
- [goog-require-example](examples/goog-require-example/README.md)  
Using traditional `goog.require`(without return) and `goog.provide`. If using `goog.provide` defines a top namespace `Foo`, this will create a global variable `Foo`. So, don't use `goog.provide` define too much top namespace.

## Options
+ goog  
  Path to Closure Library base.js file.Default is `node_modules/google-closure-library/closure/goog/base.js`.
+ sources  
  Directories and JS files path to scan dependencies.  
  Case your project has namespaces 'A', 'B', 'C' and 'A' requires 'B' but leave namespace 'C' alone. When module 'A' as the entry, after building work, webpack bundle will just cover 'A' and 'B', the namespace 'C' dropped.  
+ excludes  
  Exclude directories and JS files path.  