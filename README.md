# google-closure-library-webpack-plugin
Make webpack recognize `goog.require, goog.provide, goog.module, goog.declareModuleId`.
This plugin just transform the closure file to compatible webpack bundle, no need to install Google-Closure-Compiler.  
Currently support `google-closure-library@20200830.0.0, webpack@4.42.0`.

## Install
```sh
npm install google-closure-library-webpack-plugin --save-dev
```
## Example

The compelte example visit https://github.com/funte/template-closure-webpack-plugin-2.

### 1. goog.require example
`webpack.config.js`:
```js
new GCLibraryPlugin({
  sources: ['src/goog-module-example']
}),
```

entry file `src/goog-module-example/index.js`:
```js
// use traditional goog.require(without return) import the Foo, this will
// create a global variable.
// never use goog.provide defines too many top level namespace.
goog.require('Foo');
console.log(Foo);
module.exports = { Foo };
```

module `src/goog-module-example/foo.js`:
```js
// defines a top level namespace 'Foo'.
goog.provide('Foo');
Foo.PI = 3.14;
```

### 2. goog.module example
`webpack.config.js`:
```js
new GCLibraryPlugin({
  sources: ['src/goog-module-example']
}),
```

entry file `src/goog-module-example/index.js`:
```js
// /* directly reference the Closure file with nodejs require. */
// var Foo = require('./foo');
// console.log(Foo);
// module.exports = { Foo };

/* directly reference the Closure file from ES6 mobule. */
import Foo from './foo';
console.log(Foo);
export { Foo };
```

module file `src/goog-module-example/foo.js`:
```js
// defines a goog module with ID 'App'.
goog.module('Foo');
const PI = 3.14;
exports = { PI };
```

### 3. goog.declare example
`webpack.config.js`:
```js
new GCLibraryPlugin({
  sources: ['src/goog-declare-example']
}),
```

entry file `src/goog-declare-example/index`:
```js
/* reference ES6 module from Closure file. */

// define a goog module with ID 'App'. 
goog.module('App');
// goog.require with a return value just work in goog module.
var Foo = goog.require('Foo');
console.log(Foo);
exports = { Foo };

```

module `src/goog-declare-example/foo.js`:
```js
/* reference Closure file from ES6 module. */

// associates an ES6 module with a goog module ID 'Foo' so that is available
// via goog.require.
goog.declareModuleId('Foo');
// goog.require with a return value just work in goog module.
var Bar = goog.require('Bar');
// export Bar as default in ES6 module.
export default Bar;
```

module `src/goog-declare-example/bar.js`:
```js
// defines a goog module with ID 'Bar'.
goog.module('Bar');
var PI = 3.14;
// export by key.
exports = { PI };
```

## Options
+ goog  
  Path to Closure Library base.js file.Default is `node_modules/google-closure-library/closure/goog/base.js`.
+ sources  
  Directories and JS files path to scan dependencies.
  Case your project has namespaces 'A', 'B', 'C' and 'A' requires 'B' but leave namespace 'C' alone. When module 'A' as the entry, after building work, webpack bundle will just cover 'A' and 'B', the namespace 'C' dropped.  
+ excludes  
  Exclude directories and JS files path.