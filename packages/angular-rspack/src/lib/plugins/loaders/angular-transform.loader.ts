import type { LoaderContext } from '@rspack/core';
import { normalize } from 'path';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';
import {
  StyleUrlsResolver,
  TemplateUrlsResolver,
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
    const { typescriptFileCache } = (this._compilation as NgRspackCompilation)[
      NG_RSPACK_SYMBOL_NAME
    ]();

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
    } else if (typeof contents === 'string') {
      callback(null, contents);
    } else {
      callback(null, Buffer.from(contents));
    }
  }
}
