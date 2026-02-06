// Require the real yargs-parser module by resolving its actual path
// to avoid circular reference from moduleNameMapper
const path = require('path');
const realYargsParserPath = require.resolve('yargs-parser', {
  paths: [path.join(__dirname, '../../node_modules')],
});
const yargsParser = require(realYargsParserPath);

// yargs-parser exports a function directly.
// We need to handle both import styles:
// - import * as yargs from 'yargs-parser'  -> yargs(command, options)
// - import yargs from 'yargs-parser'       -> yargs(command, options)
//
// Use a Proxy to delegate all property access to the real yargsParser function.

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return yargsParser;
    return yargsParser[prop];
  },
  apply(target, thisArg, args) {
    return yargsParser.apply(thisArg, args);
  },
  has(target, prop) {
    return prop === '__esModule' || prop === 'default' || prop in yargsParser;
  },
  ownKeys() {
    return [...Object.keys(yargsParser), '__esModule', 'default'];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop === '__esModule') {
      return { configurable: true, enumerable: true, value: true };
    }
    if (prop === 'default') {
      return { configurable: true, enumerable: true, value: yargsParser };
    }
    const desc = Object.getOwnPropertyDescriptor(yargsParser, prop);
    if (desc) return desc;
    if (prop in yargsParser) {
      return { configurable: true, enumerable: true, value: yargsParser[prop] };
    }
    return undefined;
  },
};

// Use a function as the proxy target so 'apply' trap works
module.exports = new Proxy(function () {}, handler);
