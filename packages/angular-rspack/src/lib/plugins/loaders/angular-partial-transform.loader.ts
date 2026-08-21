import { readFile } from 'node:fs/promises';
import { LoaderContext, RawSourceMap } from '@rspack/core';
import { toTypeScriptFileCacheKey } from '@nx/angular-rspack-compiler';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';
import {
  extractInlineSourceMap,
  isForwardableSourceMap,
} from './inline-source-map';

export default function loader(
  this: LoaderContext<unknown>,
  content: string,
  inputMap?: string | RawSourceMap
) {
  const callback = this.async();
  if (
    (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME] ===
    undefined
  ) {
    callback(null, content, inputMap);
  } else {
    const {
      javascriptTransformer,
      typescriptFileCache,
      babelFileCache,
      angularCompilationFailed,
    } = (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME]();

    // The sourcemap chained by earlier loaders: source-map-loader runs first
    // and consumes the file's own sourceMappingURL comment (inline or an
    // external .map file) subject to the vendor sourcemap policy. Rspack
    // fails the module build on maps it cannot deserialize, so drop anything
    // unusable instead of forwarding it.
    const chainMap = isForwardableSourceMap(inputMap) ? inputMap : undefined;

    if (angularCompilationFailed) {
      // The build is already failing with the Angular compilation error,
      // so skip transforming and pass the original content through.
      callback(null, content, chainMap);
      return;
    }

    const request = this.resourcePath;
    if (
      request.startsWith('data:text/javascript') &&
      request.includes('__module_federation_bundler_runtime__')
    ) {
      callback(null, content, chainMap);
      return;
    }

    const normalizedRequest = toTypeScriptFileCacheKey(request);
    const cached = typescriptFileCache.get(normalizedRequest);
    if (cached !== undefined) {
      if (typeof cached !== 'string') {
        callback(null, cached.code, cached.map);
        return;
      }

      // A string entry is raw JavaScript emitted by the Angular compilation
      // (allowJs); it always needs the JavaScript transformations applied.
      javascriptTransformer
        .transformData(normalizedRequest, cached, true, false)
        .then(
          (transformed: Uint8Array) => {
            const text = Buffer.from(transformed).toString('utf8');
            const { code, map } = extractInlineSourceMap(text);
            // A newer emit may have replaced the entry while transforming;
            // only store the result for the emit it was produced from.
            if (typescriptFileCache.get(normalizedRequest) === cached) {
              typescriptFileCache.set(normalizedRequest, { code, map });
            }
            callback(null, code, map);
          },
          (error) => {
            // Fail the module instead of leaving the loader callback pending,
            // which would hang the build.
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        );
      return;
    }

    if (!content.includes('@angular')) {
      callback(null, content, chainMap);
      return;
    }

    // The chained map takes part in cache validity: the transformer reads
    // the file's external map file itself and merges it into its output, so
    // a cached transform is stale once that map changes, even though the
    // file itself did not.
    const serializedChainMap = chainMap ? JSON.stringify(chainMap) : undefined;
    const cachedTransform = babelFileCache.get(normalizedRequest);
    if (
      cachedTransform !== undefined &&
      cachedTransform.chainedMap === serializedChainMap
    ) {
      callback(null, cachedTransform.code, cachedTransform.map);
      return;
    }

    // A mismatched entry means the chained map changed since the entry was
    // produced. The transformer's persistent cache is keyed on the file
    // bytes only, so `transformFile` would return the same stale output;
    // hand it the current file data instead, which always runs the worker
    // and re-reads the changed map file. A cold process has no entry to
    // compare against, so a stale persistent entry can still be served
    // there, matching the esbuild application builder's behavior.
    const transformed =
      cachedTransform !== undefined
        ? readFile(request, 'utf8').then((data) =>
            javascriptTransformer.transformData(request, data, false, false)
          )
        : javascriptTransformer.transformFile(request, false, false);

    transformed.then(
      (contents) => {
        const text = Buffer.from(contents).toString('utf8');
        const {
          code,
          map: extractedMap,
          strippedComment,
        } = extractInlineSourceMap(text);
        // The transformer's output carries a trailing sourcemap comment only
        // when sourcemaps apply to this file: its own inline map for
        // transformed output, the file's original comment when passed
        // through untouched. A stripped comment without a usable inline map
        // references an external map file, which source-map-loader has
        // already read, so chain its map. No comment at all means sourcemaps
        // are off for this file and nothing must be forwarded.
        const map =
          extractedMap ?? (strippedComment ? serializedChainMap : undefined);
        babelFileCache.set(normalizedRequest, {
          code,
          map,
          chainedMap: serializedChainMap,
        });
        callback(null, code, map);
      },
      (error) => {
        // Fail the module instead of leaving the loader callback pending,
        // which would hang the build.
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    );
  }
}
