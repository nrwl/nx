import type { Context } from 'https://edge.netlify.com';

const framerUrl = Netlify.env.get('NEXT_PUBLIC_FRAMER_URL');

/**
 * Proxies Framer's sitemap.xml and rewrites URLs to nx.dev.
 *
 * This is a separate edge function from the main Framer proxy so that
 * the main function can keep `accept: ['text/html']` for cost savings.
 */
export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  if (!framerUrl) return context.next();

  const response = await fetch(new URL('/sitemap.xml', framerUrl).toString(), {
    headers: {
      'User-Agent': request.headers.get('User-Agent') || '',
      Accept: request.headers.get('Accept') || 'application/xml',
    },
  });

  if (!response.ok) {
    return new Response('Sitemap not available', { status: 502 });
  }

  const xml = await response.text();
  const rewrittenXml = xml.replaceAll(framerUrl, 'https://nx.dev');

  const newHeaders = new Headers(response.headers);
  newHeaders.set('content-type', 'application/xml; charset=utf-8');
  newHeaders.set('x-nx-edge-function', 'framer-sitemap');
  newHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate');

  return new Response(rewrittenXml, {
    status: 200,
    headers: newHeaders,
  });
}

export const config = {
  path: ['/sitemap-1.xml'],
};
