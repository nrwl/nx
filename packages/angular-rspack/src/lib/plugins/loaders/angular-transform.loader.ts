import type { LoaderContext } from '@rspack/core';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';
import {
  StyleUrlsResolver,
  TemplateUrlsResolver,
  toTypeScriptFileCacheKey,
} from '@nx/angular-rspack-compiler';

const _styleUrlsResolver = new StyleUrlsResolver();
const _templateUrlsResolver = new TemplateUrlsResolver();

export default function loader(
  this: LoaderContext<unknown>,
  content: string,
  opt?: {
    styleUrlsResolver: StyleUrlsResolver;
    templateUrlsResolver: TemplateUrlsResolver;
  }
) {
  const {
    styleUrlsResolver = _styleUrlsResolver,
    templateUrlsResolver = _templateUrlsResolver,
  } = opt ?? {};
  const callback = this.async();
  if (
    (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME] ===
    undefined
  ) {
    callback(null, content);
  } else {
    const {
      typescriptFileCache,
      javascriptTransformer,
      angularCompilationFailed,
    } = (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME]();

    if (angularCompilationFailed) {
      // The Angular compilation failure is already reported as a compilation
      // error. Emit empty modules instead of raw TS sources that would only
      // bury it under parser errors.
      callback(null, '');
      return;
    }

    const normalizedRequest = toTypeScriptFileCacheKey(this.resourcePath);

    const templateUrls = templateUrlsResolver.resolve(
      content,
      normalizedRequest
    );
    const styleUrls = styleUrlsResolver.resolve(content, normalizedRequest);
    for (const urlSet of [...templateUrls, ...styleUrls]) {
      // `urlSet` is a string where a relative path is joined with an
      // absolute path using the `|` symbol.
      // For example: `./app.component.html|/home/projects/analog/src/app/app.component.html`.
      const [, absoluteFileUrl] = urlSet.split('|');
      this.addDependency(absoluteFileUrl);
    }

    const cached = typescriptFileCache.get(normalizedRequest);
    if (cached !== undefined) {
      if (typeof cached !== 'string') {
        callback(null, cached.code, cached.map);
        return;
      }

      // A string entry is a raw emit from the Angular compilation: run the
      // JavaScript transformations on demand and replace the entry with the
      // result, matching the on-demand transformation in `@angular/build`'s
      // esbuild compiler plugin `onLoad` hook. Subsequent loader calls hit
      // the fast path above until a fresh emit replaces the entry again.
      javascriptTransformer
        .transformData(normalizedRequest, cached, true, false)
        .then((transformed: Uint8Array) => {
          const text = Buffer.from(transformed).toString();
          // A newer emit may have replaced the entry while transforming;
          // only store the result for the emit it was produced from.
          if (typescriptFileCache.get(normalizedRequest) === cached) {
            typescriptFileCache.set(normalizedRequest, {
              code: text,
              map: undefined,
            });
          }
          callback(null, text);
        })
        .catch((err: Error) => callback(err));
      return;
    }

    callback(null, content);
  }
}
