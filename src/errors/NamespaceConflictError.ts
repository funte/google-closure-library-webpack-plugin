import { StringFormatter } from 'slim-pig/dist/lib/str';

import { PluginError } from './PluginError';

import type { SourceLocation } from 'estree';

export class NamespaceConflictError extends PluginError {
  public readonly name: string = 'NamespaceConflictError';

  /**
   * @param options.desc - Optional description.
   */
  constructor(options: {
    file: string,
    loc?: SourceLocation,
    namespace: string,
    what: string,
    desc?: string
  }) {
    const { file, loc, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Namespace ${'namespace'} conflict with ${'what'} at file ${'file'}:${'line'}:${'column'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Namespace ${'namespace'} conflict with ${'what'} at file ${'file'}:${'line'}:${'column'}.`;
    super({ formatter, file, loc }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
