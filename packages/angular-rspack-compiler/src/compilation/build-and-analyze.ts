import { ParallelCompilation } from '@angular/build/src/tools/angular/compilation/parallel-compilation';
import { JavaScriptTransformer } from '@angular/build/src/tools/esbuild/javascript-transformer';
import { normalize } from 'path';

export async function buildAndAnalyzeWithParallelCompilation(
  parallelCompilation: ParallelCompilation,
  typescriptFileCache: Map<string, string | Uint8Array>,
  javascriptTransformer: JavaScriptTransformer
) {
  for (const {
    filename,
    contents,
  } of await parallelCompilation.emitAffectedFiles()) {
    const normalizedFilename = normalize(filename.replace(/^[A-Z]:/, ''));
    await javascriptTransformer
      .transformData(normalizedFilename, contents, true, false)
      .then((contents) => {
        typescriptFileCache.set(
          normalizedFilename,
          Buffer.from(contents).toString()
        );
      });
  }
}
