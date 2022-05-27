import _fs from 'fs-extra';

/**
 * @param file
 * @param fs - User provided file system, defaults to fs-extra.
 * @returns True if the file exists.
 */
export function existsSync(file: string, fs: any = _fs): boolean {
  if (typeof fs.exists === 'function') {
    return fs.existsSync(file);
  } else if (typeof fs.statSync === 'function') {
    try {
      fs.statSync(file);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
    return true;
  } else if (typeof fs.lstatSync === 'function') {
    try {
      fs.lstatSync(file);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
    return true;
  }

  return false;
}

/**
 * @param file
 * @param fs - User provided file system, defaults to fs-extra.
 * @returns True if the file exists.
 */
export async function exists(file: string, fs: any = _fs): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      resolve(existsSync(file, fs));
    } catch (err) {
      reject(err);
    }
  });
}
