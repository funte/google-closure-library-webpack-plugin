import { GoogTrans } from './GoogTrans';

import type { GenerateContext } from '../generate';
import type { ClosureModule, DefineParam } from '../../closure/ClosureModule';
import type { ReplaceSource } from 'webpack-sources';
import { PluginError } from '../../errors/PluginError';

export class GoogDefineTrans extends GoogTrans {
  constructor(
    public readonly module: ClosureModule,
    public readonly param: DefineParam
  ) {
    super();
  }

  apply(source: ReplaceSource, context: GenerateContext): void {
    const expr = this.param.expr;
    if (!expr.range) {
      throw new PluginError(`Undefined expression range property of define ${this.param.name}.`);
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
    let value = this.param.value;
    // Repair the missing left part.
    if (this.param.missingLeft) {
      let name = this.param.name;
      const type = this.module.getNamespaceType(this.param.name);
      // Maybe the name parameter is a namespace.
      if (type.owner) {
        const tree: any = this.module.tree;
        // If not Closure library namespace, add goog.global prefix.
        if (!tree.isLibraryNamespace(type.owner)) {
          name = `goog.global.${this.param.name}`;
        }
      }
      value = `${name} = ${this.param.value}`;
    }
    source.replace(start, end, value);
  }
}
