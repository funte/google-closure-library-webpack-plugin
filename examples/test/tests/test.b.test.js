goog.module('test.b');
goog.setTestOnly();

const b = goog.require('b');

const testSuite = goog.require('goog.testing.testSuite');
const asserts = goog.require('goog.testing.asserts');

testSuite({
  testSum() {
    asserts.assertEquals('Expect 1+2 === 3', 3, b.sum(1, 2));
  }
});
