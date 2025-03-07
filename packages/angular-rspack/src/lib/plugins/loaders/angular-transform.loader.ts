import type { LoaderContext } from '@rspack/core';
import { normalize } from 'path';
import { NG_RSPACK_SYMBOL_NAME, NgRspackCompilation } from '../../models';
import { StyleUrlsResolver, TemplateUrlsResolver } from '@ng-rspack/compiler';

const styleUrlsResolver = new StyleUrlsResolver();
const templateUrlsResolver = new TemplateUrlsResolver();

export default function loader(this: LoaderContext<unknown>, content: string) {
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

    const request = this.resourcePath;
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
