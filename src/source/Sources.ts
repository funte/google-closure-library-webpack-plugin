import _fs from 'fs-extra';
import minimatch from 'minimatch';
import pig from 'slim-pig';

import { resolveRequest } from '../utils/resolveRequest';

export interface ScanResult {
  /** All files found. */
  files: Set<string>;
  /** New added files from last scanning. */
  added: Set<string>;
  /** Modified files from last scanning. */
  modified: Set<string>;
  /** Removed files from last scanning. */
  removed: Set<string>;
  /** Missing patterns that throw ENOENT exception. */
  missing: Set<string>
}

interface SourceCache {
  /** Non glob patterns. */
  patterns: string[];
  /** Glob patterns. */
  globs: string[]
}

const isMatchAny = (pattern: string, cache: SourceCache): boolean => {
  // Match glob patterns in cache.
  for (const rule of cache.globs) {
    if (minimatch.match([pattern], rule).length !== 0) {
      return true;
    }
  }

  // Glob pattern only match glob patterns in cache.
  // If glob pattern not match any yet, return false.
  if (pig.pattern.isGlob(pattern)) {
    return false;
  }

  // Match non glob patterns in cache.
  for (const rule of cache.patterns) {
    if (pig.fs.isSameDirectory(pattern, rule)) { return true; }
    if (pig.fs.isSubDirectory(pattern, rule)) { return true; }
  }
  return false;
}

export enum MatchState {
  INCLUDE = 0,
  EXCLUDE,
  UNKNOW
};

export class Sources {
  /** Include patterns cache, must be absolute and non negative. */
  public readonly includes: SourceCache = { patterns: [], globs: [] };
  /** 
   * Exclude patterns cache, must be absolute and non negative.
   * The negative patterns also live here.
   */
  public readonly excludes: SourceCache = { patterns: [], globs: [] };

  /** Files found and their timestamp. */
  public readonly files: Map<string, number> = new Map();

  /**
   * @param patterns - List of files, directories or glob patterns.
   * @param context - An absolute directory used to resolve the relative pattern 
   * to absolute.  
   * @param fs - User provided file system, defaults to fs-extra.
   */
  constructor(
    patterns: string | string[],
    public readonly context: string,
    public readonly fs: any = _fs
  ) {
    if (typeof context !== 'string')
      throw new Error('Context must be string.');
    if (pig.pattern.isGlob(context))
      throw new Error('Context must be non glob.');
    if (!pig.pattern.isAbsolute(context))
      throw new Error('Context must be an absolute directory.');

    // Add to cache.
    this.add(patterns);
  }

  add(patterns: string | string[]): void {
    for (let pattern of ([] as string[]).concat(patterns || [])) {
      // Convert to absolute.
      pattern = resolveRequest(pattern, this.context);

      let negative = false;
      if (pattern[0] === '!') {
        negative = true;
        // Remove leading "!".
        pattern = pattern.slice(1);
      }

      // Match exclude cache, if match any, its excluded, skip it.
      if (isMatchAny(pattern, this.excludes)) continue;
      // Match include cache, if match any and not negative, its duplicate, skip it.
      if (!negative && isMatchAny(pattern, this.includes)) continue;

      const cache = negative ? this.excludes : this.includes;
      if (pig.pattern.isGlob(pattern)) {
        cache.globs.push(pattern);
      } else {
        cache.patterns.push(pattern);
      }
    }
  }

  clear(): void { this.files.clear(); }

  /**
   * @param pattern - A file, directory or glob pattern that absolute or 
   * relative from the context.
   */
  match(pattern: string): MatchState {
    if (typeof pattern !== 'string') {
      throw new Error('Pattern must be string.');
    }
    // Convert to absolute.
    pattern = resolveRequest(pattern, this.context)

    // Match exclude patterns, if match any, its excluded.
    // Note: Must be first.
    if (isMatchAny(pattern, this.excludes)) return MatchState.EXCLUDE;
    // Match include patterns, if match any, its included.
    if (isMatchAny(pattern, this.includes)) return MatchState.INCLUDE;
    // Else all are unknow.
    return MatchState.UNKNOW;
  }

  /**
   * @param patterns - List of patterns, defaults scan all.
   */
  scan(patterns?: string | string[]): ScanResult {
    const lastfiles = new Map(this.files);
    this.files.clear();
    let scanall = false;
    patterns = ([] as string[]).concat(patterns || []).map(
      pattern => resolveRequest(pattern, this.context)
    );
    if (patterns.length !== 0) {
      patterns = patterns.filter(
        pattern => this.match(pattern) === MatchState.INCLUDE
      );
    } else {
      scanall = true;
      // If patterns undefined or empty, scan whole include cache.
      patterns = this.includes.patterns.concat(this.includes.globs);
    }

    const result: ScanResult = {
      files: new Set(),
      added: new Set(),
      modified: new Set(),
      removed: new Set(),
      missing: new Set()
    };
    for (const pattern of patterns) {
      try {
        pig.fs.walkSync(
          pattern,
          file => {
            file = pig.pattern.unixlike(file);

            // If file excluded, skip it.
            if (isMatchAny(file, this.excludes)) { return; }

            const mtime = this.fs.statSync(file).mtime.valueOf();
            const lastmtime = lastfiles.get(file);
            if (typeof lastmtime === 'number') {
              // If file modified.
              if (mtime > lastmtime) { result.modified.add(file); }
            } else {
              // If file new added.
              result.added.add(file);
            }
            this.files.set(file, mtime);
            // This file still exists, delete it from lastfiles record.
            lastfiles.delete(file);
          },
          directory => {
            // If directory excluded, skip it.
            if (isMatchAny(directory, this.excludes)) { return 'skip'; }
          },
          { fs: this.fs }
        );
      } catch (err) {
        if (err.code === 'ENOENT') {
          result.missing.add(pattern);
        } else {
          throw err;
        }
      }
    }
    if (scanall) {
      result.removed = new Set(lastfiles.keys());
    } else {
      for (const [file, mtime] of lastfiles.entries()) {
        this.files.set(file, mtime);
      }
    }
    result.files = new Set(this.files.keys());
    return result;
  }
}
