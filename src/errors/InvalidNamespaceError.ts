import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class InvalidNamespaceError extends PluginError {
  public readonly name: string = 'InvalidNamespaceError';

  /**
   * @param  desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc: SourceLocation,
    desc?: string
  }) {
    const { file, loc, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Invalid namespace at file ${'file'}:${'line'}:${'column'}, namespace and module ID must be dot-separated sequence of a-z, A-Z, 0-9, _ and $, ${'desc'}.`
      : new StringFormatter().setTemplate`Invalid namespace at file ${'file'}:${'line'}:${'column'}, namespace and module ID must be dot-separated sequence of a-z, A-Z, 0-9, _ and $.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
