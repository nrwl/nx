import { LoaderContext } from '@rspack/core';
import { toTypeScriptFileCacheKey } from '@nx/angular-rspack-compiler';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';

export default function loader(this: LoaderContext<unknown>, content: string) {
  const callback = this.async();
  if (
    (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME] ===
    undefined
  ) {
    callback(null, content);
  } else {
    const {
      javascriptTransformer,
      typescriptFileCache,
      angularCompilationFailed,
    } = (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME]();

    if (angularCompilationFailed) {
      // The build is already failing with the Angular compilation error,
      // so skip transforming and pass the original content through.
      callback(null, content);
      return;
    }

    const request = this.resourcePath;
    if (
      request.startsWith('data:text/javascript') &&
      request.includes('__module_federation_bundler_runtime__')
    ) {
      callback(null, content);
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
            // A newer emit may have replaced the entry while transforming;
            // only store the result for the emit it was produced from.
            if (typescriptFileCache.get(normalizedRequest) === cached) {
              typescriptFileCache.set(normalizedRequest, {
                code: text,
                map: undefined,
              });
            }
            callback(null, text);
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
      callback(null, content);
      return;
    }

    javascriptTransformer.transformFile(request, false, false).then(
      (contents) => {
        const transformedCode = Buffer.from(contents).toString('utf8');
        typescriptFileCache.set(normalizedRequest, {
          code: transformedCode,
          map: undefined,
        });
        callback(null, transformedCode);
      },
      (error) => {
        // Fail the module instead of leaving the loader callback pending,
        // which would hang the build.
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    );
  }
}
