import { JavaScriptTransformer } from '@angular/build/private';
import { normalize } from 'path';
import { AngularCompilation } from '../models';

const JS_TS_FILE_PATTERN = /\.[cm]?[jt]sx?$/;

/**
 * Raw JS/TS content emitted by the Angular compilation, keyed by normalized
 * filename. The Rspack loader transforms entries on demand so only files the
 * bundler actually requests pay the JavaScript transformation cost.
 */
export const rawEmitCache = new Map<string, string>();

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

    const text =
      typeof contents === 'string'
        ? contents
        : Buffer.from(contents).toString();

    if (!JS_TS_FILE_PATTERN.test(normalizedFilename)) {
      typescriptFileCache.set(normalizedFilename, text);
      continue;
    }

    // Drop the previous transformed output when the raw emit changes so the
    // loader produces a fresh transform on next access.
    const previousRaw = rawEmitCache.get(normalizedFilename);
    rawEmitCache.set(normalizedFilename, text);

    if (previousRaw !== text) {
      typescriptFileCache.delete(normalizedFilename);
    }
  }
}
