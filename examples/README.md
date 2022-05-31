# Examples

| name | specification |
| --- | --- |
| [esm](./esm/README.md) | Associates an ES or CommonJS module with a Closure module ID so that is available via `goog.require`. |
| [goog.module](./goog.module/README.md) | `goog.module` example |
| [goog.module.declareLegacyNamespace](./goog.module.declareLegacyNamespace/README.md) | `goog.module.declareLegacyNamespace` example, allow you require a leagcy GOOG module in PROVIDE module |
| [goog.provide](./goog.provide/README.md) | `goog.provide` example |
| [deps](./deps/README.md) | Speedup the Webpack building process with deps file |
| [test](./test/README.md) | Using `goog.addDependency` load and execute JsUnit tests in an unbundled, uncompiled browser environment |
| [exprements.react](./exprements.react//README.md) | Convert Closure library to ES modules and use it with `react` |
| [exprements.typescript](./exprements.typescript/README.md) | Convert Closure library to ES modules and use it in `typescript` with Webpack5(Not support `tsc`, the transformed ES modules seems has many grammar issues in `typescript`) |
| [exprements.angular](./exprements.angular/README.md) | Convert Closure library to ES modules and use it with `Angular` and Webpack5 in `typescript` |

You should notice some examples name start with "exprements", these examples use a transformed Closure library that made from the original Closure library, the script [`scripts/gen.js`](./exprements.react/scripts/gen.js) shows how it transforms.  
Why not direct use the Closre library maybe you will ask. This plugin internal use the Webpack `JavascriptParser` that not support the JSX and TS file, convert Closure library to ES modules is just a makeshift fix, this may change in next version.  
As i say these examples are experiments and the transformed Closure library less test, you must be very careful, when import the transformed Closure modules, these ruels must abide:  
  1. Import goog first;  
  2. Import other Closure modules only for side effects;  
  3. Once your project use any transformed Closure module, should not use the goog APIs and original Closure library modules;   

Advice, use one index file such as `lib.js` origanize and import all needed transformed Closure modules in one time one file, and donot use these exprements examples in any official project, be patient and wait next version.  