// CJS wrapper for Prettier to avoid dynamic import issues in Jest's VM.
// Prettier v3 has a CJS entry point but `await import('prettier')` in
// format-files.ts fails without --experimental-vm-modules.
// This wrapper loads the real module via require() so formatting actually runs.
const path = require('path');
const realPrettierPath = require.resolve('prettier', {
  paths: [path.join(__dirname, '../../node_modules')],
});
const prettier = require(realPrettierPath);

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return prettier;
    return prettier[prop];
  },
  has(target, prop) {
    return prop === '__esModule' || prop === 'default' || prop in prettier;
  },
  ownKeys() {
    return [...Object.keys(prettier), '__esModule', 'default'];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop === '__esModule') {
      return { configurable: true, enumerable: true, value: true };
    }
    if (prop === 'default') {
      return { configurable: true, enumerable: true, value: prettier };
    }
    const desc = Object.getOwnPropertyDescriptor(prettier, prop);
    if (desc) return desc;
    if (prop in prettier) {
      return { configurable: true, enumerable: true, value: prettier[prop] };
    }
    return undefined;
  },
};

module.exports = new Proxy({}, handler);
