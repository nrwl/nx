/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { htmlRewritingStream } from './html-rewriting-stream';

/**
 * Pattern matching the name of the Angular nonce attribute. Note that this is
 * case-insensitive, because HTML attribute names are case-insensitive as well.
 */
const NONCE_ATTR_PATTERN = /ngCspNonce/i;

/**
 * Finds the `ngCspNonce` value and copies it to all inline `<style>` and `<script> `tags.
 * @param html Markup that should be processed.
 */
export async function addNonce(html: string): Promise<string> {
  const nonce = await findNonce(html);

  if (!nonce) {
    return html;
  }

  const { rewriter, transformedContent } = await htmlRewritingStream(html);

  rewriter.on('startTag', (tag) => {
    if (
      (tag.tagName === 'style' || tag.tagName === 'script') &&
      !tag.attrs.some((attr) => attr.name === 'nonce')
    ) {
      tag.attrs.push({ name: 'nonce', value: nonce });
    }

    rewriter.emitStartTag(tag);
  });

  return transformedContent();
}

/** Finds the Angular nonce in an HTML string. */
export async function findNonce(html: string): Promise<string | null> {
  // Inexpensive check to avoid parsing the HTML when we're sure there's no nonce.
  if (!NONCE_ATTR_PATTERN.test(html)) {
    return null;
  }

  const { rewriter, transformedContent } = await htmlRewritingStream(html);
  let nonce: string | null = null;

  rewriter.on('startTag', (tag) => {
    const nonceAttr = tag.attrs.find((attr) =>
      NONCE_ATTR_PATTERN.test(attr.name)
    );
    if (nonceAttr?.value) {
      nonce = nonceAttr.value;
      rewriter.stop(); // Stop parsing since we've found the nonce.
    }
  });

  await transformedContent();

  return nonce;
}
