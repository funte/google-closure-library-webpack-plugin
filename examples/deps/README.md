# deps
Speedup the Webpack building process with deps file.  
The `scripts/gen.js` shows how generate deps file by the API `ClosureTree.makeDependencies`.  

To build and run this app with NPM CLI:  
```sh
npm install
# Generate deps file for source files in src/lib directory.
npm run gen
npm run build
npm run start
```

If all goes well, you will see this message in your browser:  
<img src='./.README/1.png'>
