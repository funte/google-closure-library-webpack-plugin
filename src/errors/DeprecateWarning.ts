import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class DeprecateWarning extends PluginError {
  public readonly name: string = 'DeprecateWarning';

  /**
   * @param options.name - Deprecated Closure function or object name.
   * @param options.alternate - Alternative Closure function or object name.
   * @param options.desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc?: SourceLocation,
    name: string,
    alternate: string,
    desc?: string
  }) {
    const { file, loc, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`${'name'} at file ${'file'}:${'line'}:${'column'} has deprecated, please use ${'alternate'}, ${'desc'}.`
      : new StringFormatter().setTemplate`${'name'} at file ${'file'}:${'line'}:${'column'} has deprecated, please use ${'alternate'}.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
