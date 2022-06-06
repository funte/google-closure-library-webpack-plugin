import _fs from 'fs-extra';
import path from 'path';

/**
 * Find the node_modules directory.
 * @param pattern - Absolute pattern to start search, defaults to current directory.
 * @param fs - User provided file system, defaults to fs-extra.
 * @returns Return null if not found.
 * @deprecated
 */
export function findNodeModules(pattern: string, fs: any = _fs): string | null {
  if (typeof pattern !== 'string' || pattern === '') {
    pattern = __dirname;
  }

  const NODE_MODULES = 'node_modules';
  pattern = path.normalize(pattern);

  const segments = pattern.split(path.sep);
  let index = segments.indexOf(NODE_MODULES);
  if (-1 !== index) {
    return segments.slice(0, index + 1).join(path.sep);
  }

  try {
    const stat = fs.statSync(pattern);
    if (!stat.isDirectory()) {
      pattern = path.dirname(pattern);
    }

    let lastPattern = '';
    while (pattern !== lastPattern) {
      // Find node_modules in current.
      for (const dirent of fs.readdirSync(pattern, { withFileTypes: true })) {
        if (dirent.isDirectory() && dirent.name === NODE_MODULES) {
          const nodeModules = pattern + path.sep + NODE_MODULES;
          // Check whether google-closure-library package exist here.
          if (fs.existsSync(nodeModules + path.sep + 'google-closure-library')) {
            return nodeModules;
          }
        }
      }
      lastPattern = pattern;
      pattern = path.dirname(pattern);
    }
  } catch (err) {
    return null;
  }

  // Not found.
  return null;
}
