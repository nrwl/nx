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
