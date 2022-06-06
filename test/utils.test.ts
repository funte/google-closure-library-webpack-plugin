'use strict';

import { parse as acornParse } from 'acorn';
import { expect } from "chai";
import fs from 'fs';
import fsExtra from 'fs-extra';
import gracefulFs from 'graceful-fs';
import { fs as memfs } from 'memfs';
import MemoryFileSystem from 'memory-fs';
import os from 'os';
const isWin32 = os.platform() === 'win32';
import path from 'path';

import { exists, existsSync } from '../src/utils/exists';
import { readJson, readJsonSync } from '../src/utils/readJson';
import { resolveRequest } from '../src/utils/resolveRequest';
import { simpleWalkSync } from '../src/utils/simpleWalk';

describe('Test utils', () => {
  it('test resolveRequest', () => {
    if (isWin32) {
      expect(resolveRequest('D:\\')).to.equal('d:/');
      expect(resolveRequest('!D:\\')).to.equal('!d:/');
      expect(resolveRequest('a', 'D:/')).to.equal('d:/a');
      expect(resolveRequest('!a', 'D:/')).to.equal('!d:/a');
    }
  });

  describe('test simpleWalk', () => {
    it('test simpleWalkSync', () => {
      const ast: any = acornParse('var goog = {};\n', { ecmaVersion: 'latest' });
      expect(ast).to.exist;
      const allnodes: any[] = [];

      allnodes.length = 0;
      simpleWalkSync(ast, (child, parent, prop): any => {
        allnodes.push(child);
      });
      expect(allnodes.length).to.equal(5);

      allnodes.length = 0;
      simpleWalkSync(ast, (child, parent, prop): any => {
        allnodes.push(child);
        if (child.type === 'VariableDeclaration') { return 'done'; }
      });
      expect(allnodes.length).to.equal(2);

      allnodes.length = 0;
      simpleWalkSync(ast, (child, parent, prop): any => {
        allnodes.push(child);
        if (child.type === 'VariableDeclaration') { return 'skip'; }
      });
      expect(allnodes.length).to.equal(2);
    });
  });

  const jsonFile = path.resolve(__dirname, 'fixtures/foo.json');
  const noneFile = path.resolve(__dirname, 'fixtures/non exist.json');
  const helper_testWithFileSystem = (title: string, fs: any): void => {
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
  };

  // Test Nodejs fs module.
  helper_testWithFileSystem('test Nodejs fs module', fs);

  // Test fs-extra.
  helper_testWithFileSystem('test fs-extra', fsExtra);

  // Test graceful-fs.
  helper_testWithFileSystem('test graceful-fs', gracefulFs);

  // Test Webpack memory-fs(not recommend).
  const WebpackMemfs = new MemoryFileSystem();
  WebpackMemfs.mkdirpSync(path.dirname(jsonFile));
  WebpackMemfs.writeFileSync(jsonFile, fs.readFileSync(jsonFile));
  helper_testWithFileSystem('test memory-fs', WebpackMemfs);

  // Test memfs.
  memfs.mkdirpSync(path.dirname(jsonFile));
  memfs.writeFileSync(jsonFile, fs.readFileSync(jsonFile));
  helper_testWithFileSystem('test memfs', memfs);
});
