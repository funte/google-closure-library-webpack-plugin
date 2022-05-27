import type { GenerateContext } from '../generate';
import type { ReplaceSource } from 'webpack-sources';

export abstract class GoogTrans {
  apply(source: ReplaceSource, context: GenerateContext): void { };
}
