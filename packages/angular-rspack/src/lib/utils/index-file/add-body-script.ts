import { htmlRewritingStream } from './html-rewriting-stream';

export async function addBodyScript(
  html: string,
  bodyScriptContents: string,
  id: string
): Promise<string> {
  const { rewriter, transformedContent } = await htmlRewritingStream(html);

  const bodyScript = `<script id="${id}" type="text/javascript">${bodyScriptContents}</script>`;

  rewriter.on('startTag', (tag) => {
    rewriter.emitStartTag(tag);

    if (tag.tagName === 'body') {
      rewriter.emitRaw(bodyScript);
    }
  });

  return transformedContent();
}
