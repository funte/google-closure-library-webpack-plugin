'use strict';

const { expect } = require('chai');
const { describe, it } = require('mocha');
const { validate } = require('schema-utils');

const schema = require('../src/schema');

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
