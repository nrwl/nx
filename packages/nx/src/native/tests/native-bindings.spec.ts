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
  // `build-native` and `build-native-wasm` generate separate shims, so a new
  // `#[napi]` export can land in index.d.ts while the wasm ones stay stale —
  // and JS that calls it under wasm gets a TypeError instead of a value.
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

  it('should export openUrl, which has a wasm stub so callers get false rather than a TypeError', () => {
    expect(cjsExports()).toContain('openUrl');
    expect(browserExports()).toContain('openUrl');
  });
});
