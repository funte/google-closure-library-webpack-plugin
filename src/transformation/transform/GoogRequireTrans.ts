import { GoogTrans } from './GoogTrans';
import { PluginError } from '../../errors/PluginError';
import {
  getRequiredVar,
  getRequireIdentifier,
  getRequireStatement
} from '../template';

import { UnknowNamespaceError } from '../../errors/UnknowNamespaceError';

import type { GenerateContext } from '../generate';
import type { ReplaceSource } from 'webpack-sources';
import type { ClosureModule, RequireInfo } from '../../closure/ClosureModule';

/** Transform goog.require expression to import statement. */
export class GoogRequireTrans extends GoogTrans {
  constructor(
    public readonly module: ClosureModule,
    public readonly info: RequireInfo
  ) {
    super();
  }

  apply(source: ReplaceSource, context: GenerateContext): void {
    const namespace = this.info.fullname;
    const moduleSource = this.module.source;
    if (!moduleSource) {
      throw new PluginError(`Undefined Closure module source at file ${this.module.request}.`);
    }

    let requireVar: string | null;
    const requiredModule = context.tree.getModule(namespace);
    if (!requiredModule) {
      throw new UnknowNamespaceError({ namespace });
    }
    if (namespace === 'goog') {
      requireVar = 'goog';
    } else {
      if (this.info.confirmed === false) {
        throw new PluginError(
          `Unconfirmed require information of namespace ${namespace}.`
        );
      }
      requireVar = getRequiredVar(this.module, requiredModule, namespace, this.info);

      // If goog.require expression result used, replace it with equivalent identifier.
      if (this.info.used) {
        if (!this.info.expr?.range) {
          throw new PluginError(``);
        }
        const start = this.info.expr.range[0];
        // Not include the trailing semicolon, dot and LF character.
        let end = this.info.expr.range[1];
        while ([';', '.', '\r', '\n'].includes(moduleSource.charAt(end))) {
          end--;
        }
        const requireIdentifier = getRequireIdentifier(
          this.module, requiredModule, namespace, this.info
        );
        if (!requireIdentifier) {
          throw new PluginError(`Cannot find equivalent identifier of required namespace ${this.info.fullname}.`);
        }
        if (requireVar && requireIdentifier !== requireVar) {
          throw new PluginError(`Require identifier ${requireIdentifier} is not consistent with the require variable ${requireVar}.`);
        }
        source.replace(start, end, requireIdentifier);
      }
      // If goog.require expression result not used, clear this statement.
      else {
        if (!this.info.statement?.range) {
          throw new PluginError(`Undefined statement range property of required namespace ${this.info.fullname}.`);
        }
        let end = this.info.statement.range[1];
        // Back the end position until semicolon or LF character.
        while (![';', '\r', '\n'].includes(moduleSource.charAt(end))) {
          end--;
        }
        source.replace(this.info.statement.range[0], end, '');
      }
    }

    // Insert transformed require statement.
    const requireStatement = getRequireStatement(
      this.module, requiredModule, requireVar, context.env.target
    );
    source.insert(this.info.position, requireStatement);
  }
}
