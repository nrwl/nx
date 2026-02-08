import type { Context } from 'https://edge.netlify.com';

/**
 * Content negotiation for LLM-friendly docs access.
 * See: https://llmstxt.org/
 */
export default async function handler(
  request: Request,
  context: Context
): Promise<Response | URL> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const acceptHeader = request.headers.get('accept') || '';

  // Serve markdown for LLM tools that explicitly request it
  // Or if there are no accept headers passed (e.g. Cursor)
  if (!acceptHeader || acceptHeader.includes('text/markdown')) {
    const mdPath = pathname.replace(/\/?$/, '.md');
    return new URL(mdPath, request.url);
  }

  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const mdPath = pathname.replace(/\/?$/, '.md');

  const linkHeader = [
    `<${mdPath}>; rel="alternate"; type="text/markdown"`,
    `</docs/llms.txt>; rel="alternate"; type="text/markdown"; title="LLM Index"`,
    `</docs/llms-full.txt>; rel="alternate"; type="text/markdown"; title="Full Documentation"`,
  ].join(', ');

  // Netlify responses are immutable
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Link', linkHeader);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export const config = {
  path: ['/docs/*'],
  excludedPath: [
    '/docs/*.md',
    '/docs/*.js',
    '/docs/*.txt',
    '/docs/images/*',
    // _astro and other asset paths
    '/docs/_*',
  ],
};
