export function tap(
  options: any, hookOrMap: any, keys?: any | any[], callback?: Function
): void {
  keys = [].concat(keys || []);

  let waitToTap: Set<any> = new Set();
  if (keys.length === 0) {
    waitToTap.add(hookOrMap);
  } else {
    for (const key of keys) {
      if (key) { waitToTap.add(hookOrMap.for(key)); }
    }
  }
  for (const hook of waitToTap) {
    hook.tap(options, callback);
  }
}

export function tapMulti(
  options: any, hookOrMaps: any[], keys?: any | any[], callback?: Function
): void {
  keys = [].concat(keys || []);

  let waitToTap: Set<any> = new Set();
  if (keys.length === 0) {
    waitToTap = new Set(keys);
  } else {
    for (const hookOrMap of hookOrMaps) {
      for (const key of keys) {
        if (key) { waitToTap.add(hookOrMap.for(key)); }
      }
    }
  }
  for (const hook of waitToTap) {
    hook.tap(options, callback);
  }
}
