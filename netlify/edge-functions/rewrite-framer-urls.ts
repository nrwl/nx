import type { Context } from 'https://edge.netlify.com';

const framerUrl = Netlify.env.get('NEXT_PUBLIC_FRAMER_URL');
const framerPaths = new Set(
  (Netlify.env.get('NEXT_PUBLIC_FRAMER_REWRITES') || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith('/') ? p : `/${p}`))
);

/**
 * Proxies requests to Framer and rewrites URLs in responses.
 *
 * This edge function:
 * 1. Checks if the request path matches a Framer-proxied path
 * 2. If yes, fetches directly from Framer
 * 3. Rewrites Framer URLs to nx.dev in the response
 * 4. If not a Framer path, passes through to Next.js
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

  if (!framerUrl || !framerPaths.has(pathname)) return context.next();

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
  excludedPath: ['/docs/*', '/api/*', '/_next/*', '/favicon.ico'],
};
