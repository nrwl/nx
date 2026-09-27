import { join } from 'path';
import * as ts from 'typescript';
import * as viaImport from '..';

describe('native bindings loader', () => {
  it('serves vite imports and runtime requires from one binding', () => {
    // Two copies of the binding are two jemalloc heaps; a value allocated by
    // one and freed by the other kills the worker (see vitest.config.mts).
    const viaRequire: typeof viaImport = require('..');
    expect(viaRequire.TaskHasher).toBe(viaImport.TaskHasher);
  });
});

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
