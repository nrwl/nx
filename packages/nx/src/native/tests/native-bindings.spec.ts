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
      types: ['node'],
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (diagnostics.length > 0) {
      const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      });
      fail(`index.d.ts has TypeScript errors:\n${formatted}`);
    }
  });
});
