/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { htmlRewritingStream } from './html-rewriting-stream';

/**
 * Defines a name of an attribute that is added to the `<body>` tag
 * in the `index.html` file in case a given route was configured
 * with `RenderMode.Client`. 'cm' is an abbreviation for "Client Mode".
 *
 * @see https://github.com/angular/angular/pull/58004
 */
const CLIENT_RENDER_MODE_FLAG = 'ngcm';

/**
 * Transforms the provided HTML by adding the `ngcm` attribute to the `<body>` tag.
 * This is used in the client-side rendered (CSR) version of `index.html` to prevent hydration warnings.
 *
 * @param html The HTML markup to be transformed.
 * @returns A promise that resolves to the transformed HTML string with the necessary modifications.
 */
export async function addNgcmAttribute(html: string): Promise<string> {
  const { rewriter, transformedContent } = await htmlRewritingStream(html);

  rewriter.on('startTag', (tag) => {
    if (
      tag.tagName === 'body' &&
      !tag.attrs.some((attr) => attr.name === CLIENT_RENDER_MODE_FLAG)
    ) {
      tag.attrs.push({ name: CLIENT_RENDER_MODE_FLAG, value: '' });
    }

    rewriter.emitStartTag(tag);
  });

  return transformedContent();
}
