// Supplies CommonJS source the way Yarn PnP's loader does for zipped
// packages, transpiling TypeScript sources first.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    const fileName = fileURLToPath(url);
    const { outputText } = ts.transpileModule(readFileSync(fileName, 'utf-8'), {
      fileName,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    return { format: 'commonjs', source: outputText, shortCircuit: true };
  }
  const result = await nextLoad(url, context);
  if (result.format === 'commonjs' && result.source == null) {
    result.source = readFileSync(fileURLToPath(url));
  }
  return result;
}
