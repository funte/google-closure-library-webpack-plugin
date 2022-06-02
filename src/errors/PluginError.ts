import { StringFormatter } from 'slim-pig/dist/lib/str';
import WebpackError = require('webpack/lib/WebpackError');

import type { SourceLocation } from 'estree';

// export class PluginError extends WebpackError {
export class PluginError extends WebpackError {
  public readonly name: string = 'GoogleClosureLibraryWebpackPluginError';

  constructor(options: {
    formatter: string | StringFormatter,
    file?: string,
    loc?: SourceLocation,
  } | string | StringFormatter, ...values: any[]
  ) {
    let formatter: string | StringFormatter;
    let file: string | undefined = undefined;
    let loc: SourceLocation | undefined = undefined;
    if (typeof options === 'object') {
      formatter = (options as any).formatter;
      file = (options as any).file;
      loc = (options as any).loc;
    } else {
      formatter = options;
    }

    let message: string;
    if (typeof formatter === 'string') {
      message = formatter;
    } else if (formatter instanceof StringFormatter) {
      if (typeof file === 'string') {
        // Add the last dict object if missing.
        let dict = values[values.length - 1];
        if (typeof dict !== 'object') {
          values.push(dict = {});
        }

        // Merge file and location to the last dict object.
        let line = 0, column = 0;
        if (loc && typeof loc.start === 'object') {
          if (typeof loc.start.line === 'number') {
            line = loc.start.line;
          }
          if (typeof loc.start.column === 'number') {
            column = loc.start.column;
          }
        }
        Object.defineProperties(dict, {
          file: { value: file },
          line: { value: line },
          column: { value: column }
        });
      }

      // Format the string.
      message = formatter.format(...values);
    } else {
      throw new Error('Parameter formatter must be a string or StringFormatter.');
    }
    super(message);

    if (file) {
      (this as any).file = file;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}
