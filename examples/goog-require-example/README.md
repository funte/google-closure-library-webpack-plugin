# goog-require-example
Using traditional `goog.require`(without return) and `goog.provide`. If using `goog.provide` defines a top namespace `'Foo'`, this will create a global variable just like the `'goog'`. So, don't use `goog.provide` too much.  

To run this app with NPM cli:  
```sh
npm install
npm run build
npm run start
```
Then open the browser and see the log information.  
