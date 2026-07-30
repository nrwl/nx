import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

/**
 * This package is CJS; `@nx/oxlint` is ESM and imports from `./internal` by
 * name. Node builds the ESM facade for a CJS module with `cjs-module-lexer`,
 * which only sees plain `exports.x =` assignments — the `defineProperty` getter
 * that `export { default as x } from '…'` emits under `importHelpers` is
 * invisible to it, so the import throws `Named export not found` on every Node
 * below 24.14 while passing on newer ones. An e2e test cannot catch that: CI
 * pins a Node where the broken shape happens to work. The emit shape can.
 */
describe('internal entry emit shape', () => {
  const emitted = () => {
    const source = readFileSync(join(__dirname, 'internal.ts'), 'utf-8');
    return ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        importHelpers: true,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
  };

  // Deliberately excludes the `= void 0` initializer TS emits for every named
  // export: it is present under the broken shape too, so matching it would make
  // this assertion unable to fail.
  it('assigns each named export so cjs-module-lexer can see it', () => {
    expect(emitted()).toMatch(/exports\.enforceModuleBoundaries = (?!void 0)/);
  });

  it('does not export through a defineProperty getter', () => {
    expect(emitted()).not.toContain(
      'Object.defineProperty(exports, "enforceModuleBoundaries"'
    );
  });
});
