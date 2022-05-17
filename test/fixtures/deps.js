goog.addDependency("../../../../test/fixtures/src1/index.js", [], ["a", "b", "c", "d"]);
goog.addDependency("../../../../test/fixtures/src1/commonjs.js", ["a"], [], { lang: "es6" });
goog.addDependency("../../../../test/fixtures/src1/es6.js", ["b"], [], { module: "es6" });
goog.addDependency("../../../../test/fixtures/src1/module.js", ["c"], [], { module: "goog" });
goog.addDependency("../../../../test/fixtures/src1/provide.js", ["d"], []);
