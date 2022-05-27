import { ReplaceSource, Source } from 'webpack-sources';

import type { ClosureTree } from '../closure/ClosureTree';
import type { GoogTrans } from './transform/GoogTrans';
import type { Environment } from '../Environment';

export interface GenerateContext {
  tree: ClosureTree,
  env: Environment
}

export function generate(
  originalSource: Source,
  trans: GoogTrans | GoogTrans[],
  context: GenerateContext
): ReplaceSource {
  const source = new ReplaceSource(originalSource);
  for (const item of ([] as GoogTrans[]).concat(trans || [])) {
    item.apply(source, context);
  }
  return source;
}
