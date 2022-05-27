# test
Using `goog.addDependency` load and execute JsUnit test in an unbundled, uncompiled browser environment.  
The `scripts/gen.js` show how generate the JsUnit test HTML file.  

To run this app with NPM CLI:  
```sh
yarn install
# See help.
yarn run help
# Generate HTML unit test files and runner.
yarn gen
# Open the runner in browser.
yarn test:all
```

If all goes well, you will see this in your browser.   
<img src='./.README/1.jpg' width=600>

Click the `Start` button to start all tests.  
<img src='./.README/2.jpg' width=600>

Also you can use the filter start a single test.  
<img src='./.README/3.jpg' width=600>
