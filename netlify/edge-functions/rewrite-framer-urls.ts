import type { Context } from 'https://edge.netlify.com';

// Parse Framer config at module load time
const framerUrl = Netlify.env.get('NEXT_PUBLIC_FRAMER_URL');
const framerPaths = new Set(
  (Netlify.env.get('NEXT_PUBLIC_FRAMER_REWRITES') || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith('/') ? p : `/${p}`))
);

// Parse the Framer URL to get the hostname for replacement
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

  // Check if this is a Framer path
  if (!framerUrl || !framerPaths.has(pathname)) {
    // Not a Framer path, pass through to Next.js
    return context.next();
  }

  // Build Framer destination URL
  const framerDestination = new URL(pathname, framerUrl);
  url.searchParams.forEach((value, key) => {
    framerDestination.searchParams.set(key, value);
  });

  // Fetch from Framer directly
  const response = await fetch(framerDestination.toString(), {
    headers: {
      // Forward relevant headers
      'User-Agent': request.headers.get('User-Agent') || '',
      Accept: request.headers.get('Accept') || 'text/html',
      'Accept-Language': request.headers.get('Accept-Language') || '',
    },
  });

  // Only process HTML responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

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
  // Run on all paths - we check Framer paths in the handler
  path: ['/*'],
  // Only process requests from clients that want HTML
  accept: ['text/html'],
  // Exclude paths handled elsewhere
  excludedPath: ['/docs/*', '/api/*', '/_next/*', '/favicon.ico'],
};
