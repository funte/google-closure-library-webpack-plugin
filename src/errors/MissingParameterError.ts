import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class MissingParameterError extends PluginError {
  public readonly name: string = 'MissingParameterError';

  /**
   * @param options.param - Parameter name.
   * @param options.desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc?: SourceLocation,
    param: string,
    desc?: string
  }) {
    const { file, loc, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Missing parameter ${'param'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Missing parameter ${'param'} at file ${'file'}:${'line'}:${'column'}.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
