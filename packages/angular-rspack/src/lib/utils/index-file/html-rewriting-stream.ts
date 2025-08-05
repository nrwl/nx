/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { RewritingStream } from 'parse5-html-rewriting-stream';
import { loadEsmModule } from '../misc-helpers';

// Export helper types for the rewriter
export type StartTag = Parameters<RewritingStream['emitStartTag']>[0];
export type EndTag = Parameters<RewritingStream['emitEndTag']>[0];
export type { RewritingStream };

export async function htmlRewritingStream(content: string): Promise<{
  rewriter: RewritingStream;
  transformedContent: () => Promise<string>;
}> {
  const { RewritingStream } = await loadEsmModule<
    typeof import('parse5-html-rewriting-stream')
  >('parse5-html-rewriting-stream');
  const rewriter = new RewritingStream();

  return {
    rewriter,
    transformedContent: () =>
      pipeline(Readable.from(content), rewriter, async function (source) {
        const chunks: Buffer[] = [];
        for await (const chunk of source) {
          chunks.push(Buffer.from(chunk));
        }

        return Buffer.concat(chunks).toString('utf-8');
      }),
  };
}
