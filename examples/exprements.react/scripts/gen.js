require('colors');
const { Command } = require('commander');
const fs = require('fs-extra');
const { transform } = require('google-closure-library-webpack-plugin/dist/transformation/ClosureModuleTransform');
const { ClosureTree } = require('google-closure-library-webpack-plugin/dist/closure/ClosureTree');
const { Environment } = require('google-closure-library-webpack-plugin/dist/Environment');
const path = require('path');
const process = require('process');
const pig = require('slim-pig');

new Command()
  .action(async (options, program) => {
    let counts = 0;

    // Resolve the Closure library base.js file.
    let basefile = 'node_modules/google-closure-library/closure/goog/base.js';
    if (typeof options.base === 'string') {
      basefile = options.base;
    }
    basefile = pig.pattern.resolvePattern(basefile, process.cwd());
    if (!fs.existsSync(basefile)) {
      throw new Error(`Cannot find base.js file at "${basefile}".`);
    }

    // Build the Closure tree.
    const env = new Environment({ context: process.cwd(), fs });
    const tree = new ClosureTree({ env, base: basefile, sources: [] });

    if (tree.errors.length === 0) {
      const output = pig.pattern.resolvePattern(options.output, process.cwd());

      // Transform Closure modules.
      for (let module of tree.requestToModule.values()) {
        counts++;
        // Relative request from CWD.
        const relRequest = pig.pattern.unixlike(
          path.relative(process.cwd(), module.request)
        );
        // Ouput source file path.
        const file = pig.pattern.resolvePattern(
          path.relative(tree.libpath, module.request),
          output
        );

        // Ignore the deps.js file.
        if (module.isdeps) {
          console.log(`  ignore ${counts}/${tree.requestToModule.size} deps.js file ${relRequest}`.yellow);
          continue;
        }

        try {
          // ClousreTree.getModule will auto load current Closure module.
          module = tree.getModule(module.request);
          if (!module.source) {
            const error = new Error(`Undefined Closure module source at file ${module.request}.`);
            tree.errors.push(error);
            console.log(`  ignore ${counts}/${tree.requestToModule.size} missing file ${relRequest}`.red);
            continue;
          }
          const source = transform({ content: module.source, module, tree, env });
          if (!fs.existsSync(path.dirname(file))) { fs.mkdirpSync(path.dirname(file)); }

          fs.writeFileSync(
            file,
            source.source().toString(),
            { encoding: 'utf8', flag: 'w' }
          );
          const relFile = pig.pattern.unixlike(path.relative(process.cwd(), file));
          console.log(`  transform ${counts}/${tree.requestToModule.size} file ${relRequest} to ${relFile}`.green);
        } catch (err) {
          tree.errors.push(err);
        }
      }
      console.log(`Total transformed ${counts} Closure modules with ${tree.errors.length} errors ${tree.warnings.length} warnings:`.green);
    }

    // Log tree errors.
    if (tree.errors.length) {
      for (let i = 0; i < tree.errors.length; i++) {
        console.log(`Error(${i}): ${tree.errors[i].message.red}`.red);
      }
    }
    // Log tree warnings.
    if (options.warnings && tree.warnings.length) {
      for (let i = 0; i < tree.warnings.length; i++) {
        console.log(`Warning(${i}): ${tree.warnings[i].message}`.yellow);
      }
    }

    console.log(
      `REMEMBER: the transformed Closure library less test, you must be very careful!!\n`.red +
      `  1. Must import goog first!!\n`.red +
      `  2. Import other Closure modules only for side effects!!\n`.red
    );
  })
  .requiredOption('-o, --output <directory>', 'directory to output the Closure library ES modules')
  .option('-w, --warnings', 'show all warnings')
  .parse(process.argv);
