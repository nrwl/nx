import type { LoaderContext } from '@rspack/core';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';
import {
  StyleUrlsResolver,
  TemplateUrlsResolver,
  toTypeScriptFileCacheKey,
} from '@nx/angular-rspack-compiler';
import { extractInlineSourceMap } from './inline-source-map';

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
      useTypeScriptTranspilation,
      angularCompilationFailed,
      resourceDependencies,
    } = (this._compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME]();

    if (angularCompilationFailed) {
      // The Angular compilation failure is already reported as a compilation
      // error. Emit empty modules instead of raw TS sources that would only
      // bury it under parser errors.
      callback(null, '');
      return;
    }

    const normalizedRequest = toTypeScriptFileCacheKey(this.resourcePath);

    const resourceDeps = resourceDependencies?.get(normalizedRequest);
    if (resourceDeps !== undefined) {
      // The compiler tracked this file's template and stylesheet
      // dependencies; registering them keeps the module rebuilding when a
      // resource changes, at no parsing cost.
      for (const dependency of resourceDeps) {
        this.addDependency(dependency);
      }
    } else {
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
    }

    const cached = typescriptFileCache.get(normalizedRequest);
    if (cached !== undefined) {
      if (typeof cached !== 'string') {
        callback(null, cached.code, cached.map);
        return;
      }

      // A string entry is a raw emit from the Angular compilation. Without
      // TypeScript transpilation it is Angular-transformed TypeScript that
      // the bundler transpiles as-is, matching `@angular/build`.
      if (!useTypeScriptTranspilation) {
        callback(null, cached);
        return;
      }

      javascriptTransformer
        .transformData(normalizedRequest, cached, true, false)
        .then((transformed: Uint8Array) => {
          const text = Buffer.from(transformed).toString();
          const { code, map } = extractInlineSourceMap(text);
          // A newer emit may have replaced the entry while transforming;
          // only store the result for the emit it was produced from.
          if (typescriptFileCache.get(normalizedRequest) === cached) {
            typescriptFileCache.set(normalizedRequest, { code, map });
          }
          callback(null, code, map);
        })
        .catch((err: Error) => callback(err));
      return;
    }

    callback(null, content);
  }
}
