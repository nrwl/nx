// CJS wrapper for Prettier to avoid dynamic import issues in Jest's VM.
// Prettier v3 has a CJS entry point but `await import('prettier')` in
// format-files.ts fails without --experimental-vm-modules.
// This wrapper loads the real module via require() so formatting actually runs.
//
// Prettier v3's index.cjs fires a top-level `import("./index.mjs")` which
// always fails in Jest's VM context. On Node v24+ the resulting unhandled
// rejection crashes the process. We collect any rejection promises that appear
// while loading prettier and mark them handled via .catch().
const path = require('path');
const realPrettierPath = require.resolve('prettier', {
  paths: [path.join(__dirname, '../../node_modules')],
});

// Install a short-lived listener that captures rejection promises created
// by prettier's top-level import(). We .catch() them after loading to
// prevent Node from treating them as unhandled.
const rejections = new Set();
const captureRejection = (_reason, promise) => {
  rejections.add(promise);
};
process.on('unhandledRejection', captureRejection);

const prettier = require(realPrettierPath);

// The import() rejection surfaces asynchronously. Use setTimeout(0) which
// runs after both microtasks and the nextTick queue where Node fires
// unhandledRejection events, then clean up.
setTimeout(() => {
  process.removeListener('unhandledRejection', captureRejection);
  for (const p of rejections) {
    p.catch(() => {});
  }
  rejections.clear();
}, 0);

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
