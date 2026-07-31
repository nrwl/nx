import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

/**
 * This package is CJS; `@nx/oxlint` is ESM and imports from `./internal` by
 * name. Node builds the ESM facade for a CJS module with `cjs-module-lexer`,
 * and the versions vendored before Node 24.14 cannot follow an export whose
 * getter body *calls* something — which is exactly what `esModuleInterop` emits
 * for `export { default as x } from '…'`. The import then throws `Named export
 * not found`. An e2e test cannot catch it: CI pins a Node where the broken
 * shape happens to work. The emit shape can.
 */
describe('internal entry emit shape', () => {
  // Mirrors tsconfig.base.json + tsconfig.lib.json, which are what decide the
  // shape. `esModuleInterop` is the load-bearing one; `importHelpers` only
  // moves the helper into tslib.
  const emitted = () =>
    ts.transpileModule(readFileSync(join(__dirname, 'internal.ts'), 'utf-8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        importHelpers: true,
      },
    }).outputText;

  // Drops the `= void 0` initializer TS emits for every named export: it is
  // present under the broken shape too, so counting it would make this unable
  // to fail.
  const exposures = () =>
    emitted()
      .split('\n')
      .filter(
        (line) =>
          line.includes('enforceModuleBoundaries') && !line.includes('= void 0')
      );

  it('reaches the CommonJS export surface', () => {
    expect(exposures()).not.toHaveLength(0);
  });

  it('exposes each export in a shape cjs-module-lexer can follow', () => {
    // A plain `exports.x = y` assignment and a getter returning a bare member
    // expression are both followed; a getter that calls into a helper is not.
    // Verified against Node 20 and 22, where the calling shape fails to import
    // and the other two succeed.
    for (const line of exposures()) {
      expect(line).not.toMatch(/get: function \(\) \{ return .*\(/);
    }
  });
});
