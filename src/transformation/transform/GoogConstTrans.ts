import { GoogTrans } from './GoogTrans';
import { PluginError } from '../../errors/PluginError';

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
      const moduleSource = this.module.source;
      if (!moduleSource) {
        throw new PluginError(`Undefined Closure module source at file ${this.module.request}.`);
      }

      const start = this.range[0];
      // Not include the semicolon or LF character.
      let end = this.range[1];
      if (!this.module.source) {
        throw new PluginError(`Undefined Closure module source at file ${this.module.request}.`);
      }
      // Back the end position until semicolon or LF character.
      while (![';', '\r', '\n'].includes(moduleSource.charAt(end))) {
        end--;
      }
      source.replace(this.range[0], this.range[1], this.expression);
    }
  }
}
