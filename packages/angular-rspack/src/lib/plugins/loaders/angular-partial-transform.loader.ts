import { LoaderContext } from '@rspack/core';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';
import { extractInlineSourceMapCached } from './inline-source-map';

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
    if (!content.includes('@angular')) {
      callback(null, content);
      return;
    }

    const existingTransform = typescriptFileCache.get(request);
    if (existingTransform) {
      const { code, map } = extractInlineSourceMapCached(
        request,
        existingTransform
      );
      callback(null, code, map);
      return;
    }

    javascriptTransformer.transformFile(request, false, false).then(
      (contents) => {
        const transformedCode = Buffer.from(contents).toString('utf8');
        typescriptFileCache.set(request, transformedCode);
        // Hand the inline sourcemap emitted by the transformer to Rspack so
        // the mapping back to the original source is preserved; Rspack does
        // not consume inline sourcemaps from loader output on its own.
        const { code, map } = extractInlineSourceMapCached(
          request,
          transformedCode
        );
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
