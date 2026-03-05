import type { Context } from 'https://edge.netlify.com';

const framerUrl = Netlify.env.get('NEXT_PUBLIC_FRAMER_URL');

/**
 * Paths that should be served by the Next.js app instead of Framer.
 * Everything else is proxied to Framer.
 */
const nextjsPaths = new Set([
  '/blog',
  '/courses',
  '/pricing',
  '/podcast',
  '/ai-chat',
  '/changelog',
  '/resources-library',
  '/whitepaper-fast-ci',
  '/500',
]);

/**
 * Proxies requests to Framer and rewrites URLs in responses.
 *
 * This edge function proxies all requests to Framer by default.
 * Only paths explicitly listed in `nextjsPaths` (and those in
 * the `excludedPath` config) are passed through to Next.js.
 *
 * This ensures canonical URLs and other references point to nx.dev
 * instead of the Framer domain, avoiding duplicate indexing issues.
 */
export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!framerUrl || nextjsPaths.has(pathname)) return context.next();

  const framerDestination = new URL(pathname, framerUrl);
  url.searchParams.forEach((value, key) => {
    framerDestination.searchParams.set(key, value);
  });

  const response = await fetch(framerDestination.toString(), {
    headers: {
      // Forward relevant headers
      'User-Agent': request.headers.get('User-Agent') || '',
      Accept: request.headers.get('Accept') || 'text/html',
      'Accept-Language': request.headers.get('Accept-Language') || '',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();

  // This handles canonical URLs, og:url, and any other references
  const rewrittenHtml = html.replaceAll(framerUrl, 'https://nx.dev');

  const newHeaders = new Headers(response.headers);
  newHeaders.set('x-nx-edge-function', 'framer-proxy');
  newHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate');

  return new Response(rewrittenHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export const config = {
  path: ['/*'],
  // Only process HTML requests to save on compute
  accept: ['text/html'],
  excludedPath: [
    '/docs',
    '/docs/*',
    '/api/*',
    '/blog/*',
    '/courses/*',
    '/_next/*',
    '/.netlify/*',
    '/favicon.ico',
    '/webinar',
    '/sitemap.xml',
    '/sitemap-*.xml',
    // Static asset directories from public/ — must not be proxied to Framer
    '/documentation/*',
    '/assets/*',
    '/images/*',
    '/fonts/*',
    '/videos/*',
    '/data/*',
    '/socials/*',
    '/favicon/*',
  ],
};
