import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

describe('native bindings type definitions', () => {
  it('index.d.ts should pass TypeScript type-checking', () => {
    const indexDts = join(__dirname, '..', 'index.d.ts');

    const program = ts.createProgram([indexDts], {
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      // node10 is deprecated-as-error on TS 6; the repo is single-version TS6 so suppression is safe
      ignoreDeprecations: '6.0',
      types: ['node'],
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (diagnostics.length > 0) {
      const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      });
      // jest 30 removed the global fail(); throwing keeps the diagnostics visible
      throw new Error(`index.d.ts has TypeScript errors:\n${formatted}`);
    }
  });
});

describe('wasm bindings', () => {
  // Both shims come out of the same `build-native-wasm` run, so they go stale
  // together — comparing them catches a hand-edit to one, not a missed
  // regeneration. Per-export assertions below are what cover that, and they are
  // only worth adding for exports a caller invokes unguarded.
  function exportsOf(file: string, pattern: RegExp): string[] {
    const source = readFileSync(join(__dirname, '..', file), 'utf-8');
    return [...source.matchAll(pattern)].map(([, name]) => name).sort();
  }

  const cjsExports = () =>
    exportsOf('nx.wasi.cjs', /^module\.exports\.(\w+)/gm);
  const browserExports = () =>
    exportsOf('nx.wasi-browser.js', /^export const (\w+)/gm);

  it('should export the same names from both wasm shims', () => {
    expect(cjsExports()).not.toHaveLength(0);
    expect(cjsExports()).toEqual(browserExports());
  });

  it('should export openUrl, which graph --open calls without a guard', () => {
    // A missed regeneration here is a TypeError on `nx graph`, not a no-op:
    // open_url.rs keeps a wasm stub so the export always exists to be bound.
    expect(cjsExports()).toContain('openUrl');
    expect(browserExports()).toContain('openUrl');
  });
});
