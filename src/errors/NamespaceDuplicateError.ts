import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

import type { SourceLocation } from 'estree';

export class NamespaceDuplicateError extends PluginError {
  public readonly name: string = 'NamespaceDuplicateError';

  /**
   * @param desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc: SourceLocation,
    namespace: string,
    isProvide: boolean,
    desc?: string
  }) {
    const { file, loc, isProvide, desc } = options;

    const formatter = isProvide
      ? typeof desc === 'string'
        ? new StringFormatter().setTemplate`Namespace ${'namespace'} has provided at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Namespace ${'namespace'} has provided at file ${'file'}:${'line'}:${'column'}.`
      : typeof desc === 'string'
        ? new StringFormatter().setTemplate`Namespace ${'namespace'} has required at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
        : new StringFormatter().setTemplate`Namespace ${'namespace'} has required at file ${'file'}:${'line'}:${'column'}.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
