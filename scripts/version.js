const fs = require('fs');
const path = require('path');
const pig = require('slim-pig');

const MAIN_PACKAGE_PATH = path.resolve(__dirname, `../package.json`);

// Capture version numbers.
const VERSION_REGEX = /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/;
// Capture version numbers of package.json version property.
const PACKAGE_VERSION_REGEX = /"version":\s"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?"/;
// Capture sermver symbol and version numbers of google-closure-library-webpack-plugin dependency. 
const DEPENDENCY_VERSION_REGEX = /"google-closure-library-webpack-plugin":\s"([\^~])?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?"/;

/**
 * @param {string} packageJson The package.json file path.
 * @returns {string[]}
 */
const getPackageVersion = packageJson => {
  const m = PACKAGE_VERSION_REGEX.exec(fs.readFileSync(packageJson, 'utf-8'));
  if (!m || m.length != 6) {
    throw new Error(`Failed to parse version property of "${packageJson}"`);
  }
  return m.slice(1);
}

/**
 * @param {string[]} version
 * @returns {string}
 */
const makeVersionString = version => {
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
 * @param {string} packageJson The package.json file path.
 * @param {string} newVersionString New version string. 
 * @returns {void}
 */
const updateDependencyVersion = (packageJson, newVersionString) => {
  const data = fs.readFileSync(packageJson, 'utf-8');
  const m = DEPENDENCY_VERSION_REGEX.exec(data);
  if (!m) {
    throw new Error(`Failed to parse version property of "${packageJson}"`);
  }
  const oldVersionString = m[0];
  newVersionString = m[0].replace(VERSION_REGEX, newVersionString);
  fs.writeFileSync(packageJson, data.replace(oldVersionString, newVersionString));
  console.log(`  update "${path.relative(MAIN_PACKAGE_PATH, packageJson)} ${oldVersionString} to ${newVersionString}".`);
}

// Get main package version numbers.
const version = getPackageVersion(MAIN_PACKAGE_PATH);
pig.fs.walkSync(path.resolve(__dirname, '../examples'),
  file => {
    // Update version of google-closure-library-webpack-plugin dependency.
    if (path.basename(file) === 'package.json') {
      updateDependencyVersion(file, makeVersionString(version));
    }
  },
  dir => {
    const dirname = path.basename(dir);
    if (dirname === 'node_modules' || dirname === 'src')
      return 'skip';
  }
);
