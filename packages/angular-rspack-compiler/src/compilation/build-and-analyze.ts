import { JavaScriptTransformer } from '@angular/build/private';
import { normalize } from 'path';
import { AngularCompilation } from '../models';

export async function buildAndAnalyze(
  angularCompilation: AngularCompilation,
  typescriptFileCache: Map<string, string | Uint8Array>,
  javascriptTransformer: JavaScriptTransformer
) {
  for (const {
    filename,
    contents,
  } of await angularCompilation.emitAffectedFiles()) {
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
