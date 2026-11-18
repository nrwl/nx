import type { Context } from 'https://edge.netlify.com';

/**
 * Content negotiation for LLM-friendly docs access.
 * See: https://llmstxt.org/
 */
/**
 * Both variants of a docs URL have to advertise the same cache variation, or a
 * cache that stored one can hand it to a client asking for the other.
 * Netlify-Vary drives Netlify's own CDN, which ignores Vary.
 */
function withCacheVariation(response: Response, link?: string): Response {
  // Netlify responses are immutable
  const headers = new Headers(response.headers);
  headers.set('Vary', 'Accept, Accept-Encoding');
  headers.set('Netlify-Vary', 'header=accept|accept-encoding');
  if (link) {
    headers.set('Link', link);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const preloadFonts = [
  'instrument-sans-400.woff2',
  'instrument-sans-600.woff2',
  'server-mono-400.woff2',
];

export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const mdPath = pathname.replace(/\/?$/, '.md');

  const acceptHeader = request.headers.get('accept') || '';

  // Serve markdown for LLM tools that explicitly request it
  // Or if there are no accept headers passed (e.g. Cursor)
  if (!acceptHeader || acceptHeader.includes('text/markdown')) {
    return withCacheVariation(
      await context.rewrite(new URL(mdPath, request.url))
    );
  }

  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const linkHeader = [
    `<${mdPath}>; rel="alternate"; type="text/markdown"`,
    `</docs/llms.txt>; rel="alternate"; type="text/markdown"; title="LLM Index"`,
    `</docs/llms-full.txt>; rel="alternate"; type="text/markdown"; title="Full Documentation"`,
    // Brand fonts used above the fold, so text does not shift when they swap
    // in (most visible when a deep link scrolls to a heading on load).
    ...preloadFonts.map(
      (font) =>
        `</docs/fonts/${font}>; rel="preload"; as="font"; type="font/woff2"; crossorigin`
    ),
  ].join(', ');

  return withCacheVariation(response, linkHeader);
}

export const config = {
  path: ['/docs/*'],
  excludedPath: [
    '/docs/*.md',
    '/docs/*.js',
    '/docs/*.txt',
    // pagefind-entry.json; a request without an Accept header must not be
    // rewritten to a nonexistent `.md` sibling.
    '/docs/*.json',
    '/docs/images/*',
    // Agent skills mirror, forwarded here from the apex. A request without an
    // Accept header must not be rewritten to a nonexistent `.md` sibling.
    '/docs/.well-known/*',
    // _astro and other asset paths
    '/docs/_*',
  ],
};
