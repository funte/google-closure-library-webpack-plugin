import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class InvalidParameterError extends PluginError {
  public readonly name: string = 'InvalidParameterError';

  /**
   * @param options.param - Parameter name.
   * @param options.prop - Parameter property name.
   * @param options.desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc?: SourceLocation,
    param: string,
    prop?: string,
    desc?: string
  }) {
    const { file, loc, prop, desc } = options;

    const formatter: StringFormatter = typeof prop === 'string'
      ? typeof desc === 'string'
        ? new StringFormatter().setTemplate`Invalid property ${'prop'} of parameter ${'param'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Invalid property ${'prop'} of parameter ${'param'} at file ${'file'}:${'line'}:${'column'}.`
      : typeof desc === 'string'
        ? new StringFormatter().setTemplate`Invalid parameter ${'param'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Invalid parameter ${'param'} at file ${'file'}:${'line'}:${'column'}.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
