import { LoaderContext } from '@rspack/core';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';

export default function loader(this: LoaderContext<unknown>, content: string) {
  const callback = this.async();
  if (
    (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME] ===
    undefined
  ) {
    callback(null, content);
  } else {
    const { javascriptTransformer, typescriptFileCache } = (
      this._compilation as NgRspackCompilation
    )[NG_RSPACK_SYMBOL_NAME]();

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
      const existingContents =
        typeof existingTransform === 'string'
          ? existingTransform
          : Buffer.from(existingTransform).toString('utf8');
      callback(null, existingContents);
      return;
    }

    javascriptTransformer
      .transformFile(request, false, false)
      .then((contents) => {
        const transformedCode = Buffer.from(contents).toString('utf8');
        typescriptFileCache.set(request, transformedCode);
        callback(null, transformedCode);
      });
  }
}
