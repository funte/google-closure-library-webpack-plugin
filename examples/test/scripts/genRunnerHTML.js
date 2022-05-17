require('colors');
const fs = require('fs-extra');
const path = require('path');
const pig = require('slim-pig');

/** @typedef {import('google-closure-library-webpack-plugin/dist/types').ClosureTree} ClosureTree */

/**
 * Generate HTML runner file.
 * @param {string[]} htmlfiles All HTML unit test files.
 * @param {string} output The output directory.
 * @param {ClosureTree} tree
 * @returns {void}
 */
const genRunnerHTML = (htmlfiles, tree, output) => {
  // Output HTML runner file path.
  const runnerfile = pig.pattern.resolvePattern('runner.html', output);

  // Convert HTML unit test files to relative path.
  htmlfiles = htmlfiles.map(file => pig.pattern.unixlike(
    path.relative(output, file)
  ));

  // Generate HTML runner file.
  const lineIndent = `      `;
  const css = path.resolve(tree.basefile, '../css/multitestrunner.css');
  const data = `<!DOCTYPE html>
<html>

<head>
  <title>Closure - All JsUnit Tests</title>
  <script>var goog = undefined;</script>
  <script src="${pig.pattern.unixlike(path.relative(output, tree.basefile))}"></script>
  <script>
    goog.require("goog.userAgent.product");
    goog.require("goog.testing.MultiTestRunner");
  </script>
  <link rel="stylesheet" href="${pig.pattern.unixlike(path.relative(output, css))}"
    type="text/css">
  <style>
    h1 {
      font: normal x-large arial, helvetica, sans-serif;
      margin: 0;
    }

    p,
    form {
      font: normal small sans-serif;
      margin: 0;
    }

    #header {
      position: absolute;
      right: 10px;
      top: 13px;
    }

    #footer {
      margin-top: 8px;
    }

    a {
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .warning {
      font-size: 14px;
      font-weight: bold;
      width: 80%;
    }
  </style>
</head>

<body>
  <script>
    if (goog.userAgent.product.CHROME &&
      window.location.toString().indexOf("file:") == 0) {
      document.write(
        '<div class="warning">' +
        'WARNING: Due to Chrome\\'s security restrictions ' +
        'this test will not be able to load files off your local disk ' +
        'unless you start Chrome with:<br>' +
        '<code>--allow-file-access-from-files</code></div><br>');
    }
  </script>

  <h1>Closure - All JsUnit Tests</h1>
  <p id="header"></p>
  <div id="runner"></div>
  <!--  Use a form so browser persists input values -->
  <form id="footer" onsubmit="return false">
    Settings:<br>
    <input type="checkbox" name="hidepasses" id="hidepasses" checked>
    <label for="hidepasses">Hide passes</label><br>
    <input type="checkbox" name="parallel" id="parallel" checked>
    <label for="parallel">Run in parallel</label>
    <small>(timing stats not available if enabled)</small><br>
    <input type="text" name="filter" id="filter" value="">
    <label for="filter">Run only tests for path</label>
  </form>
  <script>
    var hidePassesInput = document.getElementById("hidepasses");
    var parallelInput = document.getElementById("parallel");
    var filterInput = document.getElementById("filter");
    var allTests = [
${htmlfiles.map(file => `${lineIndent}"${file}"`).join(',\n')}
    ];

    function setFilterFunction() {
      var matchValue = filterInput.value || "";
      testRunner.setFilterFunction(function (testPath) {
        return testPath.indexOf(matchValue) > -1;
      });
    }

    // Create a test runner and render it.
    var testRunner = new goog.testing.MultiTestRunner()
      .setName(document.title)
      .setBasePath("./")
      .setPoolSize(parallelInput.checked ? 8 : 1)
      .setStatsBucketSizes(5, 500)
      .setHidePasses(hidePassesInput.checked)
      //.setVerbosePasses(true)
      .addTests(allTests);
    testRunner.render(document.getElementById("runner"));

    goog.events.listen(hidePassesInput, "click", function (e) {
      testRunner.setHidePasses(e.target.checked);
    });

    goog.events.listen(parallelInput, "click", function (e) {
      testRunner.setPoolSize(e.target.checked ? 8 : 1);
    });

    goog.events.listen(filterInput, "keyup", setFilterFunction);
    setFilterFunction();
  </script>
</body>

</html>`;
  // Write HTML runner file.
  fs.writeFileSync(runnerfile, data, { encoding: 'utf8', flag: 'w' })
  console.log(`  gen HTML runner: ${path.relative(process.cwd(), runnerfile)}`.green);
}

module.exports = genRunnerHTML;
