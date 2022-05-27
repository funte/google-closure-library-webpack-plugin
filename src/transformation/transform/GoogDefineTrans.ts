import { GoogTrans } from './GoogTrans';

import type { GenerateContext } from '../generate';
import type { ClosureModule, DefineParam } from '../../closure/ClosureModule';
import type { ReplaceSource } from 'webpack-sources';
import { PluginError } from '../../errors/PluginError';

export class GoogDefineTrans extends GoogTrans {
  constructor(
    public readonly module: ClosureModule,
    public readonly define: DefineParam
  ) {
    super();
  }

  apply(source: ReplaceSource, context: GenerateContext): void {
    const expr = this.define.expr;
    if (!expr.range) {
      throw new PluginError(`Undefined expression range property of define ${this.define.name}.`);
    }
    const start = expr.range[0];
    // Not include the semicolon or LF character.
    let end = expr.range[1];
    if (!this.module.source) {
      throw new PluginError(`Undefined Closure module source at file ${this.module.request}.`);
    }
    while ([';', '\r', '\n'].includes(this.module.source.charAt(end))) {
      end--;
    }
    source.replace(start, end, this.define.value);
  }
}
