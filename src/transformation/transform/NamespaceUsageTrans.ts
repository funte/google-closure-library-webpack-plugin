import { GoogTrans } from "./GoogTrans";
import { PluginError } from "../../errors/PluginError";

import type { Expression as ExpressionNode } from 'estree';
import type { GenerateContext } from "../generate";
import type { ReplaceSource } from 'webpack-sources';

export class NamespaceUsageTrans extends GoogTrans {
  constructor(
    public readonly namespace: string,
    public readonly exprs: ExpressionNode[]
  ) {
    super();
  }

  apply(source: ReplaceSource, context: GenerateContext): void {
    for (const expr of this.exprs) {
      if (!expr.range) {
        throw new PluginError(`Undefined expresson range property of namespace ${this.namespace} usage.`);
      }
      source.insert(expr.range[0], `/* use namespace ${this.namespace} */goog.global.`);
    }
  }
}
