import { asString } from '../utils/asString';
import { createSource } from './createSource';
import { generate } from './generate';
import { PluginError } from '../errors/PluginError';

import { GoogDefineTrans } from './transform/GoogDefineTrans';
import { GoogProvideTrans } from './transform/GoogProvideTrans';
import { GoogRequireTrans } from './transform/GoogRequireTrans';
import { NamespaceUsageTrans } from './transform/NamespaceUsageTrans';

import type { ClosureModule } from '../closure/ClosureModule';
import type { ClosureTree } from '../closure/ClosureTree';
import type { Environment } from '../Environment';
import type { GoogTrans } from './transform/GoogTrans';
import type { Source } from 'webpack-sources';

function createTransforms(module: ClosureModule): GoogTrans[] {
  const trans: GoogTrans[] = [];

  // Process require informations.
  // !!Import Closure library namespace goog first.
  if (module.requires.has('goog')) {
    const info = module.requires.get('goog');
    if (!info) {
      throw new PluginError(`Undefined require information of namespace goog.`);
    }
    trans.push(new GoogRequireTrans(module, info));
  }
  for (const [namespace, info] of module.requires.entries()) {
    if (namespace === 'goog') { continue; }
    if (!info) {
      throw new PluginError(`Undefined require information of namespace ${namespace}.`);
    }
    trans.push(new GoogRequireTrans(module, info));
  }

  // Process provide informations.
  for (const [namespace, info] of module.provides.entries()) {
    if (!info) {
      throw new PluginError(`Undefined provide information of namespce ${namespace}.`);
    }
    trans.push(new GoogProvideTrans(module, info));
  }

  // Process provided, required and implicit namespace usages.
  for (const [namespace, exprs] of module.namespaceUsages.entries()) {
    trans.push(new NamespaceUsageTrans(namespace, exprs));
  }

  // Process goog.define.
  for (const [, define] of module.defines.entries()) {
    trans.push(new GoogDefineTrans(module, define));
  }
  return trans;
}

/** Tranform Closure module to ES or CommonJS module. */
export function transform(options: {
  content: string | Buffer,
  map?: any,
  module: ClosureModule,
  tree: ClosureTree,
  env: Environment
}): Source {
  const { content, map, tree, env } = options;

  // If the source has change, reload and parse again.
  if (options.module.source !== asString(content)) {
    tree.reloadModule(options.module.request, content);
  }

  // Start transform.
  return generate(
    createSource(env.context, options.module.request, content, map),
    createTransforms(options.module),
    { tree, env }
  );
}
