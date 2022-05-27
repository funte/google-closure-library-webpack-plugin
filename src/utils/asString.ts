/**
 * @see https://github.com/webpack/webpack/blob/0522deb76/lib/NormalModule.js#L128
 * @param input - The input.
 * @returns The converted string.
 */
export function asString(input: string | Buffer): string {
  if (Buffer.isBuffer(input)) {
    return input.toString("utf-8");
  }
  return input;
};
