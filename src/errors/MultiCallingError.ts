import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

export class MultiCallingError extends PluginError {
  public readonly name: string = 'MultiCallingError';

  /**
   * @param options.desc - Optional description.
   */
  constructor(options: {
    file: string,
    name: string,
    desc?: string
  }) {
    const { file, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`${'name'} should only be called once at file ${'file'}, ${'desc'}.`
      : new StringFormatter().setTemplate`${'name'} should only be called once at file ${'file'}.`;
    super({ formatter, file }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
