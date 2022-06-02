import { expect } from 'chai';
import { validate } from 'schema-utils';

import { schema } from '../src/schema';

import { BadRequire } from '../src/errors/BadRequire';

describe('Test plugin options', function () {
  it('minimum options', () => {
    expect(() => {
      validate(schema, { sources: ['src'] })
    }).to.not.throw();
    expect(() => {
      validate(schema, { sources: 'src' })
    }).to.not.throw();
  });

  it('full options', () => {
    const options = {
      base: 'path/to/base.js',
      sources: ['src'],
      target: 'esm',
      defs: [['name'], ['name', 'vaue'], ['name', true], ['name', 3], ['name', /123/], ['name', () => { }]],
      warningLevel: 'hideLib',
      debug: {
        logTransformed: true
      }
    };
    expect(() => { validate(schema, options); }).to.not.throw();
  });

  it('unknow extra property show throw', () => {
    expect(() => {
      validate(schema, { sources: 'src', foo: "foo" })
    }).to.throw();
  });
});
