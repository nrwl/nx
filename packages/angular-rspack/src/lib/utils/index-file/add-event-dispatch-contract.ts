/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { readFile } from 'node:fs/promises';
import { htmlRewritingStream } from './html-rewriting-stream';

let jsActionContractScript: string;

export async function addEventDispatchContract(html: string): Promise<string> {
  const { rewriter, transformedContent } = await htmlRewritingStream(html);

  jsActionContractScript ??=
    '<script type="text/javascript" id="ng-event-dispatch-contract">' +
    (await readFile(
      require.resolve('@angular/core/event-dispatch-contract.min.js'),
      'utf-8'
    )) +
    '</script>';

  rewriter.on('startTag', (tag) => {
    rewriter.emitStartTag(tag);

    if (tag.tagName === 'body') {
      rewriter.emitRaw(jsActionContractScript);
    }
  });

  return transformedContent();
}
