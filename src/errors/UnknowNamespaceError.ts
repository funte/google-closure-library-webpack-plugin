import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

export class UnknowNamespaceError extends PluginError {
  public readonly name: string = 'UnknowNamespaceError';

  /**
   * @param options.namespace - The missing namespace.
   * @param options.desc - Optional description.
   */
  constructor(options: {
    namespace: string,
    desc?: string
  }) {
    const { namespace, desc } = options;

    const formatter = typeof desc === 'string'
      ? new StringFormatter().setTemplate`Unknow namespace ${'namespace'}, ${'desc'}.`
      : new StringFormatter().setTemplate`Unknow namespace ${'namespace'}.`;
    super({ formatter }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};
