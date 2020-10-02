// /* directly reference the Closure file with nodejs require. */
// var Foo = require('./foo');
// console.log(Foo);
// module.exports = { Foo };

/* directly reference the Closure file from ES6 mobule. */
import Foo from './foo';
console.log(Foo);

export { Foo };
