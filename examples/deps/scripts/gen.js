const { ClosureTree } = require('google-closure-library-webpack-plugin/dist/closure/ClosureTree');
const { Environment } = require('google-closure-library-webpack-plugin/dist/Environment');
const fs = require('fs-extra');
const pig = require('slim-pig');
const process = require('process');

// Resolve the Closure library base.js file.
const basefile = pig.pattern.resolvePattern(
  'node_modules/google-closure-library/closure/goog/base.js',
  process.cwd()
);
if (!fs.existsSync(basefile)) {
  throw new Error(`Cound not find base.js file at "${basefile}".`);
}
// Build the Closure tree.
const tree = new ClosureTree({
  env: new Environment({ context: process.cwd(), fs }),
  base: basefile,
  sources: 'src/lib'
});
// Create deps.
const deps = tree.makeDependencies().map(dep => dep.text).join('\n');
fs.writeFileSync(
  pig.pattern.resolvePattern('src/deps.js', process.cwd()),
  deps
);
console.log(pig.pattern.resolvePattern('src/deps.js', process.cwd()));
