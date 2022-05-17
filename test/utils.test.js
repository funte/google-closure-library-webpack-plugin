'use strict';

const { expect } = require('chai');
const fs = require('fs');
const { describe, it } = require('mocha');
const os = require('os');
const isWin32 = os.platform() === 'win32';
const path = require('path');

const { exists, existsSync } = require('../src/utils/exists');
const findNodeModules = require('../src/utils/findNodeModules');
const { readJson, readJsonSync } = require('../src/utils/readJson');
const resolveRequest = require('../src/utils/resolveRequest');

describe('Test utils', () => {
  describe('test findNodeModules', () => {
    // it('in node_modules', () => {
    //   if (isWin32) {
    //     expect(findNodeModules('c:/path/to/node_modules')).to.equal('c:\\path\\to\\node_modules');
    //     expect(findNodeModules('c:/path/to/node_modules/foo')).to.equal('c:\\path\\to\\node_modules');
    //   } else {
    //     expect(findNodeModules('/path/to/node_modules')).to.equal('/path/to/node_modules');
    //     expect(findNodeModules('/path/to/node_modules/foo')).to.equal('/path/to/node_modules');
    //   }
    // });

    it('find directory', function () {
      expect(findNodeModules(
        path.resolve(__dirname, './fixtures/src/index.js')
      )).to.equal(
        path.resolve(__dirname, './fixtures/node_modules')
      );
    });
  });

  it('test resolveRequest', () => {
    if (isWin32) {
      expect(resolveRequest('D:\\')).to.equal('d:\\');
      expect(resolveRequest('!D:\\')).to.equal('!d:\\');
      expect(resolveRequest('a', 'D:/')).to.equal('d:\\a');
      expect(resolveRequest('!a', 'D:/')).to.equal('!d:\\a');
    }
  });

  const jsonFile = path.resolve(__dirname, 'fixtures/foo.json');
  const noneFile = path.resolve(__dirname, 'fixtures/non exist.json');
  const helper_testWithFileSystem = (title, fs) => {
    describe(title, () => {
      it('test existsSync', () => {
        expect(existsSync(jsonFile, fs)).to.true;
        expect(existsSync(noneFile, fs)).to.false;
      });

      it('test exists', async () => {
        expect(await exists(jsonFile, fs)).to.true;
        expect(await exists(noneFile, fs)).to.false;
      });

      it('test readJsonSync', function () {
        const json = readJsonSync(jsonFile, fs);
        expect(json.val).to.equal(1);
      });

      it('test readJson', async function () {
        const json = await readJson(jsonFile, fs);
        expect(json.val).to.equal(1);
      });
    });
  }

  // Test Nodejs fs module.
  helper_testWithFileSystem('test Nodejs fs module', require('fs'));

  // Test fs-extra.
  helper_testWithFileSystem('test fs-extra', require('fs-extra'));

  // Test graceful-fs.
  helper_testWithFileSystem('test graceful-fs', require('graceful-fs'));

  // Test memory-fs.
  let memfs = new (require('memory-fs'))();
  memfs.mkdirpSync(path.dirname(jsonFile));
  memfs.writeFileSync(jsonFile, fs.readFileSync(jsonFile));
  helper_testWithFileSystem('test memory-fs', memfs);

  // Test memfs.
  memfs = require('memfs').fs;
  memfs.mkdirpSync(path.dirname(jsonFile));
  memfs.writeFileSync(jsonFile, fs.readFileSync(jsonFile));
  helper_testWithFileSystem('test memfs', memfs);
});
