// Require the real chalk module by resolving its actual path
// to avoid circular reference from moduleNameMapper
const path = require('path');
const realChalkPath = require.resolve('chalk', {
  paths: [path.join(__dirname, '../../node_modules')],
});
const chalk = require(realChalkPath);

// chalk v4 is a Chalk instance where color methods (green, blue, etc.)
// are getters on the prototype, not enumerable own properties.
//
// For `import * as chalk from 'chalk'` to work, we need a Proxy that
// delegates all property access to the actual chalk instance.

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return chalk;
    return chalk[prop];
  },
  has(target, prop) {
    return prop === '__esModule' || prop === 'default' || prop in chalk;
  },
  ownKeys() {
    return [...Object.keys(chalk), '__esModule', 'default'];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop === '__esModule') {
      return { configurable: true, enumerable: true, value: true };
    }
    if (prop === 'default') {
      return { configurable: true, enumerable: true, value: chalk };
    }
    const desc = Object.getOwnPropertyDescriptor(chalk, prop);
    if (desc) return desc;
    // For prototype properties like 'green', create a descriptor
    if (prop in chalk) {
      return { configurable: true, enumerable: true, value: chalk[prop] };
    }
    return undefined;
  },
};

module.exports = new Proxy({}, handler);
