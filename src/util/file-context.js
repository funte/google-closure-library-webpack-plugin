const path = require('path');
const pig = require('slim-pig');

class FileCache {
  constructor(files, dirs) {
    this.files_ = files ? files : new Set();
    this.dirs_ = dirs ? dirs : new Set();
  }

  /**
   * Check if hit a file or directory.
   * @param {string} fileDir Directory or file path.
   */
  hit(fileDir) {
    fileDir = path.resolve(fileDir);

    /* No need to distinguish directory or file path here */
    if (this.files_.has(fileDir)) {
      return true;
    }
    for (let dir of this.dirs_) {
      if (pig.fs.isSubDirectory(fileDir, dir)) {
        return true;
      }
    }

    return false;
  }
}

class FileContext {
  /**
   * @param {Array.<string>} filesDirs Directories and files path.
   * @param {Array.<string>} excludes Exclude directories and files path.
   */
  constructor(filesDirs, excludes) {
    // Cache for directories and files path to include.
    this.includes_ = new FileCache();
    // Cache for directories and files path to exclude.
    this.excludes_ = new FileCache();

    // Cache directories and files path.
    pig.fs.separateFilesDirs(filesDirs,
      file => { this.includes_.files_.add(file); },
      dir => { this.includes_.dirs_.add(dir); }
    );
    pig.fs.separateFilesDirs(excludes,
      file => { this.excludes_.files_.add(file); },
      dir => { this.excludes_.dirs_.add(dir); }
    );
    // Merge include cache conflict.
    for (let file of this.includes_.files_.values()) {
      if (this.excludes_.hit(file)) {
        this.includes_.files_.delete(file);
      }
    }
    for (let dir of this.includes_.dirs_.values()) {
      if (this.excludes_.hit(dir)) {
        this.excludes_.dirs_.delete(dir);
      }
    }
  }

  /**
   * Register the update callback function.
   * @param {Function} callback Called when `this.update`.
   */
  registerUpdateCallback(callback) {
    this.updateCallback_ = callback;
  }

  /**
   * @return {Array.<string>} List of files to watch.
   */
  filesToWatch() {
    // Just return the files in original include cache.
    return Array.from(this.includes_.files_);
  }

  /**
   * @return {Array.<string>} List of directories to watch.
   */
  directoriesToWatch() {
    // Just return the directories in original include cache.
    return Array.from(this.includes_.dirs_);
  }

  /**
   * Scan files.
   * @return {Array.<string>} List of files found.
   */
  scan() {
    let files = new Set([...this.includes_.files_]);
    this.includes_.dirs_.forEach(includeDir => {
      pig.fs.walkSyncEx(includeDir,
        file => {
          if (!this.excludes_.hit(file)) {
            files.add(file);
          }
        },
        dir => {
          // If current exclude directory, skip it.
          if (this.excludes_.hit(dir)) {
            return { skip: true };
          }
        }
      );
    });

    return Array.from(files);
  }

  /**
   * Check if the directory or file include.
   * @param {string} fileDir Directory or file path.
   * @return {Boolean} False if not include.
   */
  filter(fileDir) {
    fileDir = path.resolve(fileDir);

    // Must lookup the exclude cache first.
    if (this.excludes_.hit(fileDir)) { return false; }

    if (this.includes_.hit(fileDir)) { return true; }

    return false;
  }
}

module.exports = FileContext;
