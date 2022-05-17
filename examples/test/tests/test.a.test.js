goog.module('test.a');
goog.setTestOnly();

const a = goog.require('a');

const testSuite = goog.require('goog.testing.testSuite');
const asserts = goog.require('goog.testing.asserts');

testSuite({
  testMulti() {
    asserts.assertEquals('Expect 1*2 === 2', 2, a.multi(1, 2));
  }
});
