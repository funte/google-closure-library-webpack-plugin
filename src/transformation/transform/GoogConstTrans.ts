import { GoogTrans } from './GoogTrans';

import type { ClosureModule } from '../../closure/ClosureModule';
import type { GenerateContext } from '../generate';
import type { ReplaceSource } from 'webpack-sources';

export class GoogConstTrans extends GoogTrans {
  constructor(
    public readonly module: ClosureModule,
    public readonly range: number | [number, number],
    public readonly expression: string = ''
  ) {
    super();
  }

  apply(source: ReplaceSource, context: GenerateContext): void {
    if (typeof this.range === 'number') {
      source.insert(this.range, this.expression || '');
    } else {
      source.replace(this.range[0], this.range[1], this.expression);
    }
  }
}
