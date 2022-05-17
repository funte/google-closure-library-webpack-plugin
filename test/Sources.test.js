'use strict';

const { expect } = require('chai');
const { describe, it } = require('mocha');

const {
  helper_writeFile,
  helper_removeFile,
  helper_touchFile
} = require('./helper');
const resolveRequest = require('../src/utils/resolveRequest');
const { Sources, MatchState } = require('../src/source/Sources');

describe('Test Sources', () => {
  const context = __dirname;

  /**
   * @param {Sources} source
   * @returns {void}
   */
  const helper_clearSources = source => {
    source.includes = {
      patterns: [],
      globs: []
    };
    source.excludes = {
      patterns: [],
      globs: []
    };
    source.files = new Map();
  }

  describe('test constructor', () => {
    it('invalid context throws', () => {
      // Non string should throw.
      expect(() => { new Sources([], undefined); }).to.throw('Context must be string.');
      // Non absolute should throw.
      expect(() => { new Sources([], 'path/to/'); }).to.throw('Context must be an absolute directory.');
      // Glob should throw.
      expect(() => { new Sources([], '**/*'); }).to.throw('Context must be non glob.');
    });
  });

  describe('test add', () => {
    const s = new Sources(undefined, context);

    it('negative pattern should add to exclude cache', () => {
      helper_clearSources(s);

      expect(s.excludes.patterns.length).to.equal(0);
      // Add a negative pattern.
      s.add('!path/to/a');
      expect(s.excludes.patterns.length).to.equal(1);
      // Add another negative pattern.
      s.add('!b');
      expect(s.excludes.patterns.length).to.equal(2);
    });

    it('add a pattern excluded should be ignored', () => {
      helper_clearSources(s);
      s.add('!**/*.js');

      // Add excluded file.
      s.add('a.js');
      expect(s.includes.patterns.length).to.equal(0);
      expect(s.includes.globs.length).to.equal(0);
    });
  });

  describe('test match', () => {
    const s = new Sources(undefined, context);

    it('match invalid string should throw', () => {
      helper_clearSources(s);

      // Match non string should throw.
      expect(() => { s.match(undefined); }).to.throw('Pattern must be string.');
    });

    it('empty Sources should always return MatchState.UNKNOW', () => {
      helper_clearSources(s);
      // Empty Sources should always return MatchState.UNKNOW.
      expect(s.match('path/to/a')).to.equal(MatchState.UNKNOW);
      expect(s.match('**/*')).to.equal(MatchState.UNKNOW);
    });

    it('match file and directory', () => {
      helper_clearSources(s);
      s.add('path/to');
      // Match include file and directory should return MatchState.INCLUDE.
      expect(s.match('path/to')).to.equal(MatchState.INCLUDE);
      expect(s.match('path/to/a')).to.equal(MatchState.INCLUDE);

      helper_clearSources(s);
      s.add('path/to');
      // Match non include file and directory should return MatchState.UNKNOW.
      expect(s.match('other/to')).to.equal(MatchState.UNKNOW);
      expect(s.match('other/to/a')).to.equal(MatchState.UNKNOW);

      helper_clearSources(s);
      s.add('!path/to');
      // Match exinclude file and directory should return MatchState.EXCLUDE.
      expect(s.match('path/to')).to.equal(MatchState.EXCLUDE);
      expect(s.match('path/to/a')).to.equal(MatchState.EXCLUDE);
    });

    it('match glob', () => {
      helper_clearSources(s);
      s.add('path/to/**/*');
      // Match include glob should return MatchState.INCLUDE.
      expect(s.match('path/to/*')).to.equal(MatchState.INCLUDE);

      helper_clearSources(s);
      s.add('path/to/**/*');
      // Match non include glob should return MatchState.UNKNOW.
      expect(s.match('other/to/*')).to.equal(MatchState.UNKNOW);

      helper_clearSources(s);
      s.add('!path/to/**/*');
      // Match exinclude glob should return MatchState.EXCLUDE.
      expect(s.match('path/to/*')).to.equal(MatchState.EXCLUDE);
    });
  });

  // !!fs must be a memory file system.
  const helper_tesScantWithFileSystem = (title, fs) => {
    describe(title, () => {
      const context = __dirname;
      const file_a = resolveRequest('path/to/a', context);
      const file_b = resolveRequest('path/to/b', context);
      const file_c = resolveRequest('path/to/c', context);
      const helper_createSources = (patterns) => {
        helper_writeFile(fs, file_a, 'wahaha');
        helper_writeFile(fs, file_b, 'wahaha');
        helper_writeFile(fs, file_c, 'wahaha');
        return new Sources(patterns, context, fs);
      }

      it('defaults scan all files', () => {
        const s = helper_createSources('path/to/**/*');
        expect(s.scan().files.length).to.equal(3);
      });

      it('scan one file', () => {
        const s = helper_createSources('path/to/**/*');
        expect(s.scan(file_a).files.length).to.equal(1);
      });

      it('scan glob pattern', () => {
        const s = helper_createSources('path/to/**/*');
        expect(s.scan('path/to/[a,b]').files.length).to.equal(2);
      });

      it('scan new added files', () => {
        const s = helper_createSources('path/to/**/*');

        let result = s.scan();
        expect(result.added.length).to.equal(3);
        result = s.scan();
        expect(result.added.length).to.equal(0);
      });

      it('scan modified files', () => {
        const s = helper_createSources('path/to/**/*');

        let result = s.scan();
        expect(result.files.length).to.equal(3);
        // Update one file.
        helper_touchFile(fs, file_a);
        result = s.scan();
        expect(result.modified.length).to.equal(1);
      });

      // it('scan removed file', () => {
      //   const s = helper_createSources('path/to/**/*');

      //   let result = s.scan();
      //   expect(result.files.length).to.equal(3);
      //   // Remove one file.
      //   helper_removeFile(fs, file_a);
      //   result = s.scan();
      //   expect(result.removed.length).to.equal(1);
      // });

      it('scan missing file', () => {
        const s = helper_createSources('path/to/**/*');

        let result = s.scan('path/to/missing');
        expect(result.missing.length).to.equal(1);
      });
    });
  }
  helper_tesScantWithFileSystem('test scan with memfs', require('memfs').fs);
});
