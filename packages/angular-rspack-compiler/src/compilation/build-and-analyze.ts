import { JavaScriptTransformer } from '@angular/build/private';
import { AngularCompilation } from '../models';
import { assertSupportedAngularRspackCompilerVersions } from '../utils/assert-supported-versions';
import {
  toTypeScriptFileCacheKey,
  type TransformedSource,
} from '../utils/source-file-cache';

/**
 * Emits the affected files of the Angular compilation into the given file
 * cache as raw, untransformed text. The Rspack loaders in `@nx/angular-rspack`
 * run the JavaScript transformer on entries on demand and replace them in
 * place, so only files the bundler actually requests pay the transformation
 * cost, matching the on-demand transformation in `@angular/build`'s esbuild
 * compiler plugin.
 *
 * @param javascriptTransformer Unused. Kept for signature compatibility; the
 * transformer now runs in the loaders.
 */
export async function buildAndAnalyze(
  angularCompilation: AngularCompilation,
  typescriptFileCache: Map<string, string | TransformedSource>,
  javascriptTransformer: JavaScriptTransformer
) {
  assertSupportedAngularRspackCompilerVersions();

  for (const {
    filename,
    contents,
  } of await angularCompilation.emitAffectedFiles()) {
    const text =
      typeof contents === 'string'
        ? contents
        : Buffer.from(contents).toString();

    // Setting the raw emit also evicts any stale transformed entry.
    typescriptFileCache.set(toTypeScriptFileCacheKey(filename), text);
  }
}
