// jest's CJS runtime refuses to load ESM, and the `createRequire` it exposes
// routes straight back into that same runtime, so an ESM-only dependency has to
// be compiled here for a mock to hand back the real implementation.
// Specs that swap `fs` for memfs would otherwise hide the dependency's own files.
const fs = jest.requireActual('fs');
const path = require('path');
const vm = require('vm');
const { transformSync } = require('@swc/core');

const cache = new Map();

/**
 * Loads an ESM file and the relative graph below it as CommonJS. Bare
 * specifiers are left to `require` - they are builtins or packages jest can
 * already load.
 */
exports.loadEsm = function loadEsm(entryPath) {
  const filePath = path.resolve(entryPath);
  const cached = cache.get(filePath);
  if (cached) return cached.exports;

  const module = { exports: {} };
  cache.set(filePath, module);

  const { code } = transformSync(fs.readFileSync(filePath, 'utf-8'), {
    filename: filePath,
    module: { type: 'commonjs' },
    jsc: { parser: { syntax: 'ecmascript' }, target: 'esnext' },
  });

  const dirname = path.dirname(filePath);
  const localRequire = (specifier) =>
    specifier.startsWith('.')
      ? loadEsm(path.resolve(dirname, specifier))
      : require(specifier);

  vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {${code}\n})`,
    { filename: filePath }
  )(module.exports, localRequire, module, filePath, dirname);

  return module.exports;
};
