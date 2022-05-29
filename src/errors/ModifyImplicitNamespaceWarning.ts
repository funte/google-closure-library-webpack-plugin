import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class ModifyImplicitNamespaceWarning extends PluginError {
  public readonly name: string = 'ModifyImplicitNamespaceWarning';

  /**
   * @param options.desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc?: SourceLocation,
    namespace: string,
    desc?: string
  }) {
    const { file, loc, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Modify implicitly constructed namespace ${'namespace'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Modify implicitly constructed namespace ${'namespace'} at file ${'file'}:${'line'}:${'column'}.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
