const path = require('path');
const exec = require('child_process');
const fs = require('fs');
const pig = require('slim-pig');

const MAIN_PACKAGE_PATH = path.resolve(__dirname, `../package.json`);
const EXAMPLES_DIR = path.resolve(__dirname, `../examples`);

// Capture major, minor, patch, release and build versions.
const VERSION_REGEX = /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/;
// Capture major, minor, patch, release and build versions from `package.json` file version property.
const PACKAGE_VERSION_REGEX = /\"version\"\:\s\"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?\"/;
// Capture `google-closure-library-webpack-plugin` denpendency's SEMVER symbol, major, minor, patch, release and build versions. 
const NODEDEP_VERSION_REGEX = /\"google-closure-library-webpack-plugin\"\:\s\"([\^\~])?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?\"/;

/*
{
  path: string, // The `package.json` file path.
  oldStr: '', // string.
  newStr: '', // string.
  m: {}, // The match result.
}
*/
var versionHistory = [];

/**
 * @param {string} packageFilePath The `package.json` file path.
 * @return {Array<string>} List of version number major, minor, path and the 
 *   additional version string pre-release and build metadata.
 */
const getPackageVersion = function (packageFilePath) {
  let m = PACKAGE_VERSION_REGEX.exec(fs.readFileSync(packageFilePath, 'utf-8'));
  if (!m || m.length != 6)
    throw new Error(`Failed to parse version property from "${packageFilePath}"`);
  if (m[1] === undefined || m[2] === undefined || m[3] === undefined)
    throw new Error(`Invalid version property "${m[0]}" at "${packageFilePath}"`);
  return m.slice(1, 6);
}

const makeVersionString = function (version) {
  if (typeof version === 'string')
    return version;

  var versionString = version.slice(0, 3).join('.');
  if (version[3])
    versionString += ('-' + version[3]);
  if (version[4])
    versionString += ('+' + version[4]);

  return versionString;
}

/**
 * @param {Array<string>} oldVersion Get from `getMainPackageVersion`.
 */
const makeNewwVersion = function (oldversion) {
  var newVersion;

  if (process.argv[2]) {
    let m = VERSION_REGEX.exec(process.argv[2]);
    if (!m || m.length !== 6)
      throw new Error(`Fail to parse version argument \"${process.argv[2]}\"`);
    newVersion = m.slice(1, 6);
  } else {
    // Using old verison number, just increment patch number.
    newVersion = Array.from(oldversion);
    newVersion[2] = String(Number(newVersion[2]) + 1);
  }
  return newVersion;
}

/**
 * @param {string} packageFilePath The `package.json` file path.
 * @param {string} newVersionString New version string. 
 * @return {Object} Version history.
 */
const updatePackageVerion = function (packageFilePath, newVersionString) {
  var history = {
    path: packageFilePath,
    oldStr: null,
    newStr: null,
    m: null
  };

  let text = fs.readFileSync(packageFilePath, 'utf-8');
  history.m = PACKAGE_VERSION_REGEX.exec(text);
  if (!history.m)
    throw new Error(`Failed to parse version property from "${packageFilePath}"`);
  history.oldStr = history.m[0];
  history.newStr = history.m[0].replace(VERSION_REGEX, newVersionString);
  fs.writeFileSync(packageFilePath, text.replace(history.oldStr, history.newStr));

  console.log(`  update "${path.basename(MAIN_PACKAGE_PATH)}".`);
  return history;
}

/**
 * @param {string} packageFilePath The `package.json` file path.
 * @param {string} newVersionString New version string. 
 * @return {Object} Version history.
 */
const updateDependencyVersion = function (packageFilePath, newVersionString) {
  var history = {
    path: packageFilePath,
    oldStr: null,
    newStr: null,
    m: null
  };

  let text = fs.readFileSync(packageFilePath, 'utf-8');
  history.m = NODEDEP_VERSION_REGEX.exec(text);
  if (!history.m)
    throw new Error(`Failed to parse version property from "${packageFilePath}"`);
  history.oldStr = history.m[0];
  history.newStr = history.m[0].replace(VERSION_REGEX, newVersionString);
  fs.writeFileSync(packageFilePath, text.replace(history.oldStr, history.newStr));

  console.log(`  update "${path.relative(MAIN_PACKAGE_PATH, packageFilePath)}".`);
  return history;
}

/**
 * @param {Object} history Return from `updatePackageVerion` or `updateDependencyVersion`.
 */
const restoreVersion = function (history) {
  let text = fs.readFileSync(history.path, 'utf-8');
  fs.writeFileSync(history.path, text.replace(history.newStr, history.oldStr));
  if (history.path === MAIN_PACKAGE_PATH)
    console.log(`  restore "package.json".`);
  else
    console.log(`  restore "${path.relative(MAIN_PACKAGE_PATH, history.path)}".`);
}

try {
  const version = getPackageVersion(MAIN_PACKAGE_PATH);
  const versionString = makeVersionString(version);
  const newVersionString = makeVersionString(makeNewwVersion(version));
  console.log(`Update version "${versionString}" to "${newVersionString}": `);
  // Update main package version.
  versionHistory.push(updatePackageVerion(MAIN_PACKAGE_PATH, newVersionString));
  // Update examples package node dependency version.
  pig.fs.walkSyncEx(EXAMPLES_DIR,
    file => {
      if (path.basename(file) === `package.json`) {
        versionHistory.push(updateDependencyVersion(file, newVersionString));
      }
    },
    dir => {
      const tokens = pig.str.unixlike(dir).split(`/`);
      const dirname = tokens[tokens.length - 1];
      if (dirname === `node_modules`)
        return { skip: true };
    }
  );
  // Stage vertion history.
  versionHistory.forEach(history => {
    exec.execSync(`git add ${history.path}`);
  });
  
} catch (error) {
  console.error(`Error: ${error.message}`);
  if (versionHistory.length) {
    console.log(`Restore version from history:`);
    versionHistory.forEach(history => { restoreVersion(history); });
  }
}
