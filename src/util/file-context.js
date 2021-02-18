const path = require('path');
const pig = require('slim-pig');

class FileCache {
  constructor(files, dirs) {
    this._files = files ? files : new Set();
    this._dirs = dirs ? dirs : new Set();
  }

  /* Add a file or directory, this method may add unnecessary directory or file,
  using `shrink` remove it. */
  addFile(file) { this._files.add(file); }
  addDir(dir) { this._dirs.add(dir); }

  /* Delete a file or directory. */
  delFile(file) { this._files.delete(file); }
  delDir(dir) { this._dirs.delete(dir); }

  files() { return Array.from(this._files); }
  dirs() { return Array.from(this._dirs); }

  /**
   * Check if has a directory or file.
   * @param {string} fileDir Directory or file path.
   * @param {string} fileDir False if the directory or file not cache.
   */
  has(fileDir) {
    /* No need to distinguish directory or file path here */
    fileDir = path.resolve(fileDir);

    if (this._files.has(fileDir)) {
      return true;
    }
    if (this._dirs.has(fileDir)) {
      return true;
    }
    for (let dir of this._dirs) {
      if (pig.fs.isSubDirectory(fileDir, dir)) {
        return true;
      }
    }

    return false;
  }

  /* Remove unnecessary directories or files.  */
  shrink() {
    // Shrink directories.
    this.dirs().forEach(child => {
      this.dirs().forEach(parent => {
        if (child !== parent) {
          if (pig.fs.isSubDirectory(child, parent)) {
            this._dirs.delete(child);
          }
        }
      });
    });

    // Shrink files.
    this.files().forEach(child => {
      this.dirs().forEach(parent => {
        if (pig.fs.isSubDirectory(child, parent)) {
          this._files.delete(child);
        }
      });
    });
  }
}

class FileContext {
  /**
   * @param {Array<string>} filesDirs Directories and files path.
   * @param {Array<string>} excludes Exclude directories and files path.
   */
  constructor(filesDirs, excludes) {
    // Cache for directories and files path to include.
    this.includes = new FileCache();
    // Cache for directories and files path to exclude.
    this.excludes = new FileCache();
    // Cache found files.
    this._files = new Set();

    this.exclude(excludes);
    this.include(filesDirs);
  }

  /**
   * Just return the files in original include cache.
   * @return {Array<string>} List of files to watch.
   */
  filesToWatch() { return this.includes.files(); }

  /**
   * Just return the directories in original include cache.
   * @return {Array<string>} List of directories to watch.
   */
  directoriesToWatch() { return this.includes.dirs(); }

  /**
   * Scan files.
   * @param {Boolean} force Scan files anyway if true.
   * @return {Array<string>} List of files found.
   */
  scan(force = false) {
    if (force || Array.from(this._files).length === 0) {
      this._files = new Set([...this.includes._files]);
      this.includes.dirs().forEach(includeDir => {
        pig.fs.walkSyncEx(includeDir,
          file => {
            if (!this.excludes.has(file)) {
              this._files.add(file);
            }
          },
          dir => {
            // If current exclude directory, skip it.
            if (this.excludes.has(dir)) {
              return { skip: true };
            }
          }
        );
      });
    }

    return Array.from(this._files);
  }

  /**
   * Check if the directory or file include and not exclude.
   * @param {string} fileDir Directory or file path.
   * @return {Boolean} False if not include or exclude.
   */
  has(fileDir) {
    fileDir = path.resolve(fileDir);

    // Must lookup the exclude cache first.
    if (this.excludes.has(fileDir)) { return false; }

    if (this.includes.has(fileDir)) { return true; }

    return false;
  }

  /**
   * Update include files and directories.
   * @param {Array{string}} filesDirs Directories and files path.
   */
  include(filesDirs) {
    this._files.clear();

    pig.fs.separateFilesDirs(filesDirs,
      file => { this.includes.addFile(file); },
      dir => { this.includes.addDir(dir); }
    );
    this.includes.shrink();
    // Resolve conflicts in cache.
    this._merge();
  }

  /**
   * Update exclude files and directories.
   * @param {Array{string}} filesDirs Directories and files path.
   */
  exclude(filesDirs) {
    this._files.clear();

    pig.fs.separateFilesDirs(filesDirs,
      file => { this.excludes.addFile(file); },
      dir => { this.excludes.addDir(dir); }
    );
    this.excludes.shrink();
  }

  /* Resolve conflicts by applying exlucde cache to include cache, keep the include 
  cache minimum, remove unnecessary directories and files from include cache.*/
  _merge() {
    this.includes.files().forEach(file => {
      if (this.excludes.has(file))
        this.includes.delFile(file);
    });
    this.includes.dirs().forEach(dir => {
      if (this.excludes.has(dir))
        this.includes.delDir(dir);
    })
  }
}

module.exports = { FileCache, FileContext };
