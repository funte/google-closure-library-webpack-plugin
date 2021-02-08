const path = require('path');
const fs = require('fs');
const pig = require('slim-pig');

const sepratePaths_ = (pathArray, fileCallback, directoryCallback) => {
  if (Array.isArray(pathArray)) {
    pathArray.forEach(item => {
      sepratePaths_(item, fileCallback, directoryCallback);
    });
  } else {
    const absPath = path.resolve(pathArray);
    if (fs.existsSync(absPath)) {
      const stat = fs.statSync(absPath);
      if (stat.isFile()) {
        if (fileCallback) {
          fileCallback(absPath);
        }
      } else if (stat.isDirectory()) {
        if (directoryCallback) {
          directoryCallback(absPath);
        }
      } else {
        // Skip.
        // throw new Error(`Unrecognized path \"${absPath}\"!!`);
      }
    }
  }
};

module.exports = function (sources, excludes) {
  sources = sources || [];
  excludes = excludes || [];
  var sourceFiles = new Set();

  sepratePaths_(sources,
    filePath => {
      sourceFiles.add(filePath);
    },
    directoryPath => {
      pig.fs.walkSync(directoryPath, filePath => {
        sourceFiles.add(filePath);
      });
    }
  );

  sepratePaths_(excludes,
    filePath => {
      sourceFiles.delete(filePath);
    },
    directoryPath => {
      pig.fs.walkSync(directoryPath, filePath => {
        sourceFiles.delete(filePath);
      });
    }
  );

  return sourceFiles;
};
