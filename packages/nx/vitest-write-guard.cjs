/**
 * Guard: a unit test may not write the real repo's nx.json or package.json.
 * Surfaces the offending test with a stack instead of silently clobbering the
 * file. Covers the sync and promise write/append entry points - `fs/promises`
 * is a separate exports object, and nx writes through it (`writeJsonFileAsync`
 * in src/utils/fileutils.ts), so patching `fs` alone would miss that path.
 *
 * Loaded via `execArgv` rather than `setupFiles`: node snapshots the ESM named
 * exports of these modules on first import, so a patch applied from a setup
 * file is invisible to source that does `import { writeFile } from 'fs'`.
 */
const fs = require('fs');
const fsPromises = require('fs/promises');
const { join, resolve } = require('path');

const workspaceRoot = resolve(__dirname, '..', '..');
const guarded = new Set([
  join(workspaceRoot, 'nx.json'),
  join(workspaceRoot, 'package.json'),
]);

function guard(target, moduleName, name) {
  const original = target[name];
  if (typeof original !== 'function') return;
  target[name] = function (file, ...rest) {
    if (typeof file === 'string' && guarded.has(resolve(file))) {
      throw new Error(
        `[vitest-setup] A test attempted to ${moduleName}.${name} the real workspace file ${file}`
      );
    }
    return original.call(this, file, ...rest);
  };
}

for (const name of [
  'writeFileSync',
  'writeFile',
  'appendFileSync',
  'appendFile',
]) {
  guard(fs, 'fs', name);
}
for (const name of ['writeFile', 'appendFile']) {
  guard(fsPromises, 'fs/promises', name);
}
