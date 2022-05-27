/**
 * @see https://github.com/webpack/webpack/blob/0522deb76/lib/NormalModule.js#L128
 * @param input - The input.
 * @returns The converted buffer.
 */
export function asBuffer(input: string | Buffer): Buffer {
  if (!Buffer.isBuffer(input)) {
    return Buffer.from(input, "utf-8");
  }
  return input;
}
