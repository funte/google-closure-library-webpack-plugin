module.exports = {
  root: true,
  env: {
    node: true,
    es6: true
  },
  parser: "babel-eslint",
  parserOptions: {
    ecmaVersion: 2018
  },
  extends: [
    "eslint:recommended"
  ],
  rules: {
    "no-undef": ["warn"],
    "no-unused-vars": ["warn", { args: "all" }]
  }
}
