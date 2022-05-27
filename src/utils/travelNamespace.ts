/**
 * For namespace "a.b.c", the travel order is (a, a) => (b, a.b) => (c, a.b.c).
 * @param namespace - Full namespace, dot-separated sequence of a-z, A-Z, 0-9, _ and $.
 * @param Callback - Return false to stop the travel.
 */
export function travelNamespaceFromRoot(
  namespace: string,
  callback?: (name: string, fullname: string) => void | false
): void {
  if (typeof namespace !== 'string') { return; }
  const parts = namespace.split('.');
  for (let index = 0; index < parts.length; index++) {
    const name = parts[index];
    const fullname = parts.slice(0, index + 1).join('.');
    if (callback && callback(name, fullname) === false) {
      break;
    }
  }
}

/**
 * For namespace "a.b.c", the travel order is (c, a.b.c) => (b, a.b) => (a, a).
 * @param namespace - Full namespace, dot-separated sequence of a-z, A-Z, 0-9, _ and $.
 * @param Callback - Return false to stop the travel.
 */
export function travelNamespaceToRoot(
  namespace: string,
  callback?: (name: string, fullname: string) => void | false
): void {
  if (typeof namespace !== 'string') { return; }
  const parts = namespace.split('.');
  for (let index = parts.length - 1; index >= 0; index--) {
    const name = parts[index];
    const fullname = parts.slice(0, index + 1).join('.');
    if (callback && callback(name, fullname) === false) {
      break;
    }
  }
}
