import { GoogTrans } from './GoogTrans';
import { ModuleType } from '../../closure/ClosureModule';
import { PluginError } from '../../errors/PluginError';
import { getExportStatement } from '../template';

import type { ClosureModule, ProvideInfo } from '../../closure/ClosureModule';
import type { GenerateContext } from '../generate';
import type { ReplaceSource } from 'webpack-sources';

/**
 * Transform goog.module/provide/declareModuleId/declareNamespace expression,
 * and add export statement.
 */
export class GoogProvideTrans extends GoogTrans {
  constructor(
    public readonly module: ClosureModule,
    public readonly info: ProvideInfo
  ) {
    super();
  }

  apply(source: ReplaceSource, context: GenerateContext): void {
    const namespace = this.info.fullname;
    const moduleSource = this.module.source;
    if (!moduleSource) {
      throw new PluginError(`Undefined Closure module source at file ${this.module.request}.`)
    }

    if (this.info.statement) {
      if (!this.info.statement.range) {
        throw new PluginError(`Undefined statement range property of provided namespace ${this.info.fullname}.`);
      }
      // Clear the provide statement.
      let end = this.info.statement.range[1];
      // Back the end position until semicolon or LF character.
      while (![';', '\r', '\n'].includes(moduleSource.charAt(end))) {
        end--;
      }
      source.replace(this.info.statement.range[0], end, '');
    }

    // Clear the goog.module.declareLegacyNamespace statement.
    if (this.module.legacy) {
      if (!this.module.legacy.range) {
        throw new PluginError(`Undefined legacy statement range property at file ${this.module.request}.`);
      }
      let end = this.module.legacy.range[1];
      // Back the end position until semicolon or LF character.
      while (![';', '\r', '\n'].includes(moduleSource.charAt(end))) {
        end--;
      }
      source.replace(this.module.legacy.range[0], end, '');
    }

    // Construct provided and implicit namespaces in this module.
    // Here use spread "a = a||{}; a.b = a.b||{}; a.b.c = {};" assignments 
    // instead the goog.exportPath_ to construct the namespaces, these 
    // transformation should not rely on any goog API.
    const chunks: string[] = [];
    const isPROVIDEModule = this.module.type === ModuleType.PROVIDE;
    const isGOOGModule = this.module.type === ModuleType.GOOG;
    const isLegacyGOOGModule = !!this.module.legacy;
    // Add associated local variable declaration.
    if (isGOOGModule && !this.info.declaration) {
      chunks.push(`var exports = {};\n`);
    }
    // Construct implicit namespaces.
    if (isPROVIDEModule || isLegacyGOOGModule) {
      const prefix = context.tree.isLibraryModule(this.module.request)
        ? ''
        : 'goog.global.';
      if (this.info.implicities) {
        for (let implicitNamespace of this.info.implicities) {
          implicitNamespace = `${prefix}${implicitNamespace}`;
          // Implicit namespace maybe intialized in required module, its must be 
          // checked first.
          chunks.push(`/** construct implicit namespace ${implicitNamespace} */${implicitNamespace} = ${implicitNamespace} || {};\n`);
        }
      }
      // Construct provided namespace.
      const providedNamespace = `${prefix}${namespace}`;
      if (isPROVIDEModule) {
        // The Webpack internal HarmonyImportDependency insert transformed import
        // statement at stage STAGE_HARMONY_IMPORTS, this will break the order 
        // with other construct namespace statements. 
        // So, the provided namespace must be intialized like the implicit namespace.
        // chunk.push(`/** construct provided ${_namespace} */${_namespace} = {};\n`);
        chunks.push(`/** construct provided namespace ${providedNamespace} */${providedNamespace} = ${providedNamespace} || {};\n`);
      } else if (isLegacyGOOGModule) {
        chunks.push(`${providedNamespace} = ${this.info.id};\n`);
      }
    }
    // Insert chunks to source.
    if (chunks.length > 0) {
      const position = isGOOGModule && this.info.declaration
        // @ts-ignore
        ? this.info.declaration.range[1]
        // @ts-ignore
        : this.info.expr.range[1];
      if (position === undefined) {
        throw new PluginError(`Missing position of namespace construct statements at file ${this.module.request}.`);
      }
      source.insert(position, chunks.join(''));
    }

    // Append transformed export statement.
    if (namespace === 'goog' || isGOOGModule) {
      if (!this.info.id) {
        throw new PluginError(`Undefined exported local variable id at file ${this.module.request}.`);
      }
      const exportStatement = getExportStatement(
        this.module, this.info.id, context.env.target
      );
      source.insert(moduleSource.length, exportStatement);
    }
  }
}
