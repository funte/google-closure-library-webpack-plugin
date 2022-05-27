import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class UnexpectCallingError extends PluginError {
  public readonly name: string = 'UnexpectCallingError';

  /**
   * @param name - Closure function name.
   * @param desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc: SourceLocation,
    name: string,
    desc?: string
  }) {
    const { file, loc, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Unexpect ${'name'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Unexpect ${'name'} at file ${'file'}:${'line'}:${'column'}.`
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
