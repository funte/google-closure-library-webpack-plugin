require('colors');
const fs = require('fs-extra');
const path = require('path');
const process = require('process');
const pig = require('slim-pig');

/** @typedef {import('google-closure-library-webpack-plugin/dist/closure/ClosureModule').DependencyParam} DependencyParam */
/** @typedef {import('google-closure-library-webpack-plugin/dist/closure/ClosureTree').ClosureTree} ClosureTree */

/**
 * Generate HTML unit test file.
 * @param {string} file The JS unit test file path.
 * @param {string} output The output directory.
 * @param {ClosureTree} tree
 * @returns {string} Output HTML test file path.
 */
const genTestHTML = (file, output, tree) => {
  const m = /([^\\/]+)\.test\.js$/.exec(file);
  if (!m || m.length !== 2) return;
  const shortname = m[1];
  // Output HTML unit test file path.
  const htmlfile = pig.pattern.resolvePattern(`${shortname}.test.html`, output);

  // Find Closure module of the JS unit test file.
  const module = tree.getModule(file);
  if (!module) {
    throw new Error(`Could not found module ${file}.`);
  }

  // Collect all dependencies.
  // !!No need combine Closure library deps.js here, the goog debug loader
  // will do it with the doc.write within goog.debugLoader_.loadClosureDeps() 
  // when goog.CLOSURE_NO_DEPS enabled.
  /** @type {DependencyParam[]} */
  const deps = [];
  // Add JS unit test file to dependencies.
  deps.push(tree.makeDependencyParam(module.request));
  // Add tested file to dependencies, search all required namespaces and filter
  // out the Closure library namespaces.
  for (const namespace of module.requires.keys()) {
    const testedModule = tree.getModule(namespace);
    if (!testedModule) {
      throw new Error(`Could not find module of namespace ${namespace}.`);
    }
    // Filter out the Closure library namespace.
    if (tree.isLibraryModule(testedModule.request)) { continue; }
    deps.push(tree.makeDependencyParam(testedModule.request));
  }

  const provides = Array.from(module.provides.keys());
  if (provides.length !== 1) {
    throw new Error(`JS unit test file ${module.request} must and only provide one namespace.`);
  }

  // Generate HTML unit test file.
  const lineIndent = `    `;
  const data = `<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">
  <title>Closure Unit Test - ${provides[0]}</title>
</head>

<body>
  <script>var goog = undefined;</script>
  <script src="${pig.pattern.unixlike(path.relative(output, tree.basefile))}"></script>
  <script>
    // Add dependencies.
    // !!No need to combine Closure library deps.js here, the goog debug loader will create a script tag execute it, see goog.debugLoader_.loadClosureDeps().
${deps.map(dep => lineIndent + dep.text).join(`\n`)}

    // Require this unit test, then the goog debug loader will create many script tags.
    goog.require("${provides[0]}");
  </script>
</body>

</html>`;
  // Write the HTML unit test file to output directory.
  fs.writeFileSync(htmlfile, data, { encoding: 'utf8', flag: 'w' });
  console.log(`  gen HTML unit test: ${path.relative(process.cwd(), htmlfile)}`.green);

  return htmlfile;
}

module.exports = genTestHTML;
