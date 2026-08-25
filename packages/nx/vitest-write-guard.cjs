/**
 * Guard: nothing in a unit test may write the real repo's nx.json or
 * package.json. Surfaces the offending test with a stack instead of silently
 * clobbering the file.
 *
 * Loaded via `execArgv` rather than `setupFiles`: node snapshots the ESM named
 * exports of `fs` on first import, so a patch applied from a setup file is
 * invisible to source that does `import { writeFileSync } from 'fs'`. Running
 * before any module links covers both channels.
 */
const fs = require('fs');
const { join, resolve } = require('path');

const workspaceRoot = resolve(__dirname, '..', '..');
const guarded = new Set([
  join(workspaceRoot, 'nx.json'),
  join(workspaceRoot, 'package.json'),
]);

for (const name of ['writeFileSync', 'writeFile']) {
  const original = fs[name];
  fs[name] = function (target, ...rest) {
    if (typeof target === 'string' && guarded.has(resolve(target))) {
      throw new Error(
        `[vitest-setup] A test attempted to ${name} the real workspace file ${target}`
      );
    }
    return original.call(this, target, ...rest);
  };
}
