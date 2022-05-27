import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class NamespaceOutModuleError extends PluginError {
  public readonly name: string = 'NamespaceOutModuleError';

  /**
   * @param desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc: SourceLocation,
    namespace: string,
    desc?: string
  }) {
    const { file, loc, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Using namespace ${'namespace'} outside PROVIDE and legacy GOOG module at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Using namespace ${'namespace'} outside PROVIDE and legacy GOOG module at file ${'file'}:${'line'}:${'column'}.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
