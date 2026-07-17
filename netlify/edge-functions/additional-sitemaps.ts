import type { Context } from 'https://edge.netlify.com';

/**
 * Proxies the per-source sitemaps referenced by the root sitemap index
 * (see `scripts/patch-sitemap-index.mjs` for the `additionalSitemaps` list)
 * and rewrites URLs from the source origin to nx.dev.
 *
 * Separate from the main Framer proxy so that proxy can keep
 * `accept: ['text/html']` for compute cost savings.
 *
 * Routing:
 *   /sitemap-1.xml -> NEXT_PUBLIC_FRAMER_URL + /sitemap.xml
 *   /sitemap-2.xml -> BLOG_URL + /blog/sitemap.xml
 */
const sources: Record<string, { envVar: string; path: string }> = {
  '/sitemap-1.xml': { envVar: 'NEXT_PUBLIC_FRAMER_URL', path: '/sitemap.xml' },
  '/sitemap-2.xml': { envVar: 'BLOG_URL', path: '/blog/sitemap.xml' },
};

export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const source = sources[pathname];
  if (!source) return context.next();

  const origin = Netlify.env.get(source.envVar);
  if (!origin) return context.next();

  const response = await fetch(new URL(source.path, origin).toString(), {
    headers: {
      'User-Agent': request.headers.get('User-Agent') || '',
      Accept: request.headers.get('Accept') || 'application/xml',
    },
  });

  if (!response.ok) {
    return new Response('Sitemap not available', { status: 502 });
  }

  const xml = await response.text();
  const rewrittenXml = xml.replaceAll(origin, 'https://nx.dev');

  const newHeaders = new Headers(response.headers);
  newHeaders.set('content-type', 'application/xml; charset=utf-8');
  newHeaders.set('x-nx-edge-function', 'additional-sitemaps');
  newHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate');

  return new Response(rewrittenXml, {
    status: 200,
    headers: newHeaders,
  });
}

export const config = {
  path: ['/sitemap-1.xml', '/sitemap-2.xml'],
};
