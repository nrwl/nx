import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

/**
 * This package is CJS; `@nx/oxlint` is ESM and imports from `./internal` by
 * name. Node's CJS named-export analyzer cannot follow an export whose getter
 * body *calls* something — which is exactly what `esModuleInterop` emits for
 * `export { default as x } from '…'` — so the import throws `Named export not
 * found`. Fixed in Node 24.14, where the analyzer changed from cjs-module-lexer
 * to merve; Node 20 and 22 vendor the current cjs-module-lexer and still fail.
 *
 * Nothing else would catch it. PR-gating CI runs Node 26, where the broken
 * shape works; the nightly matrix is the only place a failing Node runs, and no
 * e2e imports the bridge there either.
 */
describe('internal entry emit shape', () => {
  // Pins the two options that decide the shape rather than the whole tsconfig:
  // `esModuleInterop` is the load-bearing one, `importHelpers` only moves the
  // helper into tslib. (The real build uses `nodenext`/`ES2021`; emit for this
  // construct is identical.)
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

  it("exposes each export in a shape Node's CJS analyzer can follow", () => {
    // A plain `exports.x = y` assignment and a getter returning a bare member
    // expression are both followed; a getter that calls into a helper is not.
    // Verified against Node 20 and 22, where the calling shape fails to import
    // and the other two succeed.
    for (const line of exposures()) {
      expect(line).not.toMatch(/get: function \(\) \{ return .*\(/);
    }
  });
});
