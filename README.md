# google-closure-library-webpack-plugin
Webpack5 plugin for google-closure-library, inspired from [closure-webpack-plugin](https://www.npmjs.com/package/closure-webpack-plugin).  

This plugin transpile the Closure module to ES and CommonJS module, no need to install [google-closure-compiler](https://github.com/google/closure-compiler).  

Now support `google-closure-library@<=20220502.0.0`, `webpack@>=5.21.0`, Webpack watch mode and these goog APIs:  
* `goog.require`  
  Will be transpiled to ES or CommonJS import statement, depend on the [target](#target--optional-"esm"-or-"commonjs"-defaults-to-"esm") option.  
* `goog.provide`(deprecated), `goog.module` and `goog.module.declareLegacyNamespace`  
  Will be transpiled to ES or CommonJS export statement, depend on the [target](#target--optional-"esm"-or-"commonjs"-defaults-to-"esm") option.  
  >[In addition, goog.provide() creates the object stubs for a namespace (for example, goog.provide("goog.foo.bar") will create the object goog.foo.bar if it does not already exist).](https://google.github.io/closure-library/api/goog.html#provide)
  >
  As above mentioned, `goog.provide` will expose a global accessible object in the `goog.global`, you can direct use it and its sub namespaces after `goog.require`, but the `goog.module` is completely opposite, its module structure more pure, flat and individual.  
* `goog.declareModuleId` and `goog.module.declareNamespace`(deprecated)  
  Associates an ES or CommonJS module with a Closure module ID so that is available via `goog.require`, see example [esm](./examples/esm/README.md).  
* `goog.addDependency`  
  `goog.addDependency` will be treat as directive and the goog debug loader not work anymore, the only usage of `goog.addDependency` see section [Speedup the Webpack building process with deps file](#💊speedup-the-webpack-building-process-with-deps-file);  
* `goog.define`  
  All `goog.define` expressions that not mentioned in the [defs](#defs--optional-array-type) option, will be replaced with its default value, see [defs](#defs--optional-array-type) option.  

🎉🎉🎉This plugin is still maintained, welcom to create issue if you find bugs or has any expectant feature🎉🎉🎉  

## Install
```sh
npm install google-closure-library-webpack-plugin --save-dev
```

## Examples
[Here](./examples/README.md) are many examples that can download, build and run it. 

## Options
### **base** : *optional string type, defaults to `node_modules/google-closure-library/closure/goog/base.js`*
  Path to Closure library `base.js` file, must be absolute or relative from the Webpack [context](https://webpack.js.org/configuration/entry-context/#context).  
### **sources** : *required string or array type*
  List of absolute patterns, or relative from the Webpack [context](https://webpack.js.org/configuration/entry-context/#context). You can use the negative patterns(start with `!`) ignore files or directories.  
  Supported glob features see [minimatch#features](https://github.com/isaacs/minimatch#features).  
### **target** : *optional "esm" or "commonjs", defaults to "esm"*
  Closure module transform target, "esm" or "commonjs", defaults to "esm".  
### **defs** : *optional array type*
  List of string and value to override the `goog.define` expression, e.g. source `const MSG = goog.define("msg", "Hello World!!");` will be converted to `const MSG = "哈喽啊 树哥!!";` with defs option `defs: [["msg", "哈喽啊 树哥!!"]]`.  
  If the name part is omitted, its value will be true, e.g. source `const FLAG = goog.define("flag", false);` will be converted to `const FLAG = true;` with defs options `defs: [["flag"]]`.  
### **warningLevel**: *optional "hide", "hideLib", "hideUser" and "hide", defaults to "hideLib"*
  "show" show all warnings, "hidelib" hide warnings in Closure library modules and show warnings in user modules, "hideUser" opposite to "hideLib", "hide" hide all warnings, defualts to "hideLib".  
### **debug.logTransformed** : *optional boolean type, defaults to false*
  Enable log transformed Closure module to build directory, defaults to false.  

## Something important
### 💊Speedup the Webpack building process with deps file
  Everytime when start the building process by the [Webpack build command](https://webpack.js.org/api/cli/#build), this plugin will search and parse all files found in the `sources` options. Obviously, it's very expensive and unnecessary, but if you specific a deps file like the `deps.js` in Closure library, this plugin will make a quick through and skip the parsing work until its requied by the `goog.require` statement.  
  How speedup building process with deps file, see example [deps](./examples/deps/README.md).  
### 💊How test your code, is the `goog.testing` still work?
  No, but you can still use it with `goog.addDependency` load and execute JsUnit tests in an unbundled, uncompiled browser environment, see example [test](./examples/test/README.md).  
  Also you can directly test the Webpack bundle file with `mocha` and other tools.  
### 💊Influenced symbols in compiled base.js file
  + `COMPILED` force to `true`;  
  + `goog.DEBUG` force to `false`;  
  + Replace `goog.global` with [options.output.globalObject](https://webpack.js.org/configuration/output/#outputglobalobject);  

## Error case
TODO: add error case.

## TODOS
These features will add to next version.  
* ✔ ClosureTree.check;  
* More test, test whole Closure library;  
* Check whether unexposed namespace(except Closure library modules) outside PROVIDE and legacy GOOG module has dot serparator, like this:  
  ```
  // X: in this GOOG module, namespace "a.b.c" not exposed but has dot separator, should error.
  goog.module("a.b.c");
  ```
* Check whether unexposed namespce(except Closure library modules) outside PROVIDE and legacy GOOG module duplicate with other exposed namespace, like this:  
  ```
  // a.js
  // In this GOOG module, namespace "a" not exposed.
  goog.module("a");

  // b.js
  // X: in this PROVIDE module, namespace "a.b" exposed and will construct a duplicated implicit namespace "a", should error.
  goog.provide("a.b");
  ```
* `ClosureModuleParserPlugin` support JS/TS/TSX, add more `target` option;  
* Support soy template?  
* Parser annotations?  

## News
* [VSCode extension Closure-Namespace-View](https://github.com/funte/VSCODE-Closure-Namspace-View) has released, use it quickly browse your Closure namespace  
  <img src=.READMES/1.png>  
