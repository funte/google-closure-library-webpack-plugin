import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { ModuleType } from '../closure/ClosureModule';

export class MixedModuleTypeError extends PluginError {
  public readonly name: string = 'MixedModuleTypeError';

  /**
   * @param options.desc - Optional description.
   */
  constructor(options: {
    file: string,
    type1: ModuleType,
    type2: ModuleType,
    desc?: string
  }) {
    const { file, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Type of module ${'file'} cannot be both ${'type1'} and ${'type2'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Type of module ${'file'} cannot be both ${'type1'} and ${'type2'}.`;
    super({ formatter, file }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
