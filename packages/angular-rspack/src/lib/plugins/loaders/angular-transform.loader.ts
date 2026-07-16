import type { LoaderContext } from '@rspack/core';
import { normalize } from 'path';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';
import {
  StyleUrlsResolver,
  TemplateUrlsResolver,
} from '@nx/angular-rspack-compiler';
import { extractInlineSourceMapCached } from './inline-source-map';

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
    const { typescriptFileCache, angularCompilationFailed } = (
      this._compilation as NgRspackCompilation
    )[NG_RSPACK_SYMBOL_NAME]();

    if (angularCompilationFailed) {
      // The Angular compilation failure is already reported as a compilation
      // error. Emit empty modules instead of raw TS sources that would only
      // bury it under parser errors.
      callback(null, '');
      return;
    }

    const request = this.resourcePath.replace(/^[A-Z]:/, '');
    const normalizedRequest = normalize(request);

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

    const contents = typescriptFileCache.get(normalizedRequest);
    if (contents === undefined) {
      callback(null, content);
    } else {
      // The cached contents carry an inline sourcemap (emitted by ngc and
      // chained through the Angular linker). Rspack does not consume inline
      // sourcemaps from loader output, so extract it and pass it to the
      // callback to preserve the mapping back to the original TypeScript.
      const { code, map } = extractInlineSourceMapCached(
        normalizedRequest,
        contents
      );
      callback(null, code, map);
    }
  }
}
