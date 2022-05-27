import fs from 'fs-extra';
import path from 'path';

import { asString } from "../utils/asString";
import { transform } from '../transformation/ClosureModuleTransform';
import { PluginError } from '../errors/PluginError';

import type { LoaderClosureContext } from "../plugins/LoaderPlugin";
import type { Source } from 'webpack-sources';

/** !!Note: Should not use arrow function here. */
export = function (
  this: any & { closure: LoaderClosureContext },
  content?: any,
  map?: any,
  meta?: any
): void {
  const { callback, closure, _compiler, resource } = this;

  // Do nothing if not Closure module.
  if (!closure || !closure.tree.hasModule(resource)) {
    return callback(null, content, map, meta);
  }

  let source: Source;
  try {
    if (!content) {
      throw new PluginError(`Undefined loader content of Closure module ${resource}.`);
    }
    const module = closure.tree.getModule(resource);
    if (!module) {
      throw new PluginError(``);
    }
    source = transform({
      content,
      map,
      module,
      tree: closure.tree,
      env: closure.env
    });
  } catch (err) {
    closure.tree.errors.push(err);
    return callback(err, content, map, meta);
  }

  // Log transformed Closure module.
  if (closure.env.logTransformed) {
    const output = _compiler?.options.output?.path;
    if (!output) {
      closure.tree.warnings.push(
        new PluginError(`Undefined output path in Webpack compiler options.`)
      );
    } else {
      // Ignore Closure library module.
      if (!closure.tree.isLibraryModule(resource)) {
        if (!fs.existsSync(output)) {
          fs.mkdirpSync(output);
        }
        fs.writeFileSync(
          path.resolve(output, `transformed_${path.basename(resource)}`),
          asString(source.source().toString())
        );
      }
    }
  }

  // @ts-ignore
  callback(null, source.source(), source.map(), meta);
}
