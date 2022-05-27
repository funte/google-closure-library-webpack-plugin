require('colors');
const { Command } = require('commander');
const fs = require('fs-extra');
const { ClosureTree } = require('google-closure-library-webpack-plugin/dist/closure/ClosureTree');
const { Environment } = require('google-closure-library-webpack-plugin/dist/Environment');
const pig = require('slim-pig');
const process = require('process');

const genTestHTML = require('./genTestHTML');
const genRunnerHTML = require('./genRunnerHTML');

new Command()
  .action(async (options, program) => {
    // Resolve the Closure library base.js file.
    let basefile = 'node_modules/google-closure-library/closure/goog/base.js';
    if (typeof options.base === 'string') {
      basefile = options.base;
    }
    basefile = pig.pattern.resolvePattern(basefile, process.cwd());
    if (!fs.existsSync(basefile)) {
      throw new Error(`Cound not find base.js file at "${basefile}".`);
    }

    // Build the Closure tree.
    const tree = new ClosureTree({
      env: new Environment({ context: process.cwd(), fs }),
      base: basefile,
      // Also add all JS unit test files to source.
      sources: (options.sources || []).concat(options.tests || [])
    });
    // Log tree errors.
    if (tree.errors.length !== 0) {
      for (const err of tree.errors) {
        console.log(`Errors: ${err.message.red}`.red);
        process.exit(1);
      }
    }
    // Log tree warnings.
    if (tree.warnings.length !== 0) {
      for (const warning of tree.warnings) {
        console.log(`Warning: ${warning.message}`.yellow);
      }
    }

    // Resolve the output directory.
    const output = pig.pattern.resolvePattern(options.output, process.cwd())

    // To save all HTML unit test files path.
    const htmlfiles = [];
    // Search unit test JS file.
    for (let filedir of [].concat(options.tests || [])) {
      filedir = pig.pattern.resolvePattern(filedir, process.cwd());
      pig.fs.walkSync(filedir, file => {
        if (/([^\\/]+)\.test\.js$/.test(file)) {
          // Generate unit test HTML file.
          htmlfiles.push(
            genTestHTML(file, output, tree)
          );
        }
      });
    }

    // Generate HTML runner file.
    genRunnerHTML(htmlfiles, tree, output);
  })
  .option('-b, --base <file>', 'path to Closure library base.js file, defaults to <CWD>/node_modules/google-closure-library/closure/goog/base.js')
  .requiredOption('-s, --sources <entries...>', 'list of absolute patterns, or relative from the CWD')
  .requiredOption('-t, --tests <entries...>', 'list of directories or *.test.js files')
  .requiredOption('-o, --output <directory>', 'output *.test.html files directory')
  .parse(process.argv);
