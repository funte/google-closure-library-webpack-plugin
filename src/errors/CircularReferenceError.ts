import { StringFormatter } from "slim-pig/dist/lib/str";

import { PluginError } from "./PluginError";

export class CircularReferenceError extends PluginError {
  public readonly name: string = 'CircularReferenceError';

  constructor(options: {
    stack: string
  }) {
    const formatter = new StringFormatter().setTemplate`Circular reference at require stack: \n${'stack'}`;
    super({ formatter }, options);

    Error.captureStackTrace(this, this.constructor);
  }
};

