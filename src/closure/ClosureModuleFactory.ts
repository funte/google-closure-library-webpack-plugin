import JavascriptParser = require('webpack/lib/javascript/JavascriptParser');

import { ClosureModule } from './ClosureModule';
import { ClosureModuleParserPlugin } from './ClosureModuleParserPlugin';

import type { ClosureTree } from "./ClosureTree";
import type { Environment } from "../Environment";
import type { PluginError } from '../errors/PluginError';

export class ClosureModuleFactory {
  private parser: any;

  public errors: PluginError[] = [];
  public warnings: PluginError[] = [];

  create(
    request: string,
    tree: ClosureTree,
    env: Environment
  ): ClosureModule | null {
    const parser = this.getParser(tree, env);
    let module: ClosureModule | null;
    try {
      module = new ClosureModule({ request, tree, env, parser });
    } catch (err) {
      this.errors.push(err);
      module = null;
    }
    return module;
  }

  getParser(tree: ClosureTree, env: Environment): any {
    if (!this.parser) {
      this.parser = new JavascriptParser();
      new ClosureModuleParserPlugin(tree, env).apply(this.parser);
    }

    return this.parser;
  }
}
