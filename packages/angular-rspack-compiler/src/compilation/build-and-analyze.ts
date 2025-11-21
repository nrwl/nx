import { JavaScriptTransformer } from '@angular/build/private';
import { normalize } from 'path';
import { AngularCompilation } from '../models';

const JS_TS_FILE_PATTERN = /\.[cm]?[jt]sx?$/;

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

    // Skip JavaScript transformation for non-JS/TS files (JSON, CSS, etc.)
    // Let Rspack handle these through its native module rules
    if (!JS_TS_FILE_PATTERN.test(normalizedFilename)) {
      const text =
        typeof contents === 'string'
          ? contents
          : Buffer.from(contents).toString();
      typescriptFileCache.set(normalizedFilename, text);
      continue;
    }

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
