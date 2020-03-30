const path = require('path');
const fs = require('fs');
const pig = require('slim-pig');

const sepratePaths_ = (pathArray, fileCallback = null, directoryCallback = null) => {
  if (Array.isArray(pathArray)) {
    pathArray.forEach(item => {
      sepratePaths_(item, fileCallback, directoryCallback);
    });
  } else {
    const absPath = path.resolve(pathArray);
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
      throw new Error(`Unrecognized path ${pathArray}!!`);
    }
  }
};

module.exports = function (sources, excludes) {
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