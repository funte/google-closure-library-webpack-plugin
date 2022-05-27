import _fs from 'fs-extra';

/**
 * @param fs - User provided file system, defaults to fs-extra.
 */
export function readJsonSync(file: string, fs: any = _fs): any {
  if (typeof fs.readJsonSync === 'function') {
    return fs.readJsonSync(file);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * @param fs - User provided file system, defaults to fs-extra.
 */
export async function readJson(file: string, fs: any = _fs): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      resolve(readJsonSync(file, fs));
    } catch (err) {
      reject(err);
    }
  });
}
