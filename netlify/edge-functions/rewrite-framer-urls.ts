import type { Context } from 'https://edge.netlify.com';

const framerUrl = Netlify.env.get('NEXT_PUBLIC_FRAMER_URL');
const blogUrl = Netlify.env.get('BLOG_URL');
const GA_MEASUREMENT_ID =
  Netlify.env.get('GA_MEASUREMENT_ID') || 'G-XXXXXXXXXX';
const GA_API_SECRET = Netlify.env.get('GA_API_SECRET') || '';

// GA4 tracking — must live here because Framer-proxied responses skip context.next(),
// so track-page-requests.ts never fires for these paths due to alphabetical ordering.
// https://docs.netlify.com/build/edge-functions/declarations/#declaration-processing-order

/**
 * Creates a TransformStream that performs string replacement on text chunks,
 * correctly handling matches that span chunk boundaries.
 */
function createStreamingReplace(
  search: string,
  replace: string
): TransformStream<string, string> {
  let buffer = '';
  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      // Hold back enough chars to catch matches split across chunks
      const safeEnd = buffer.length - (search.length - 1);
      if (safeEnd > 0) {
        controller.enqueue(
          buffer.substring(0, safeEnd).replaceAll(search, replace)
        );
        buffer = buffer.substring(safeEnd);
      }
    },
    flush(controller) {
      if (buffer) {
        controller.enqueue(buffer.replaceAll(search, replace));
      }
    },
  });
}

/**
 * Streams a proxied HTML response, rewriting `search` → `replace` on the fly.
 * Removes Content-Length since the body size changes with replacements.
 */
function streamWithRewrite(
  response: Response,
  search: string,
  replace: string
): ReadableStream<Uint8Array> {
  return response
    .body!.pipeThrough(new TextDecoderStream())
    .pipeThrough(createStreamingReplace(search, replace))
    .pipeThrough(new TextEncoderStream());
}

function getClientId(request: Request): string {
  const cookies = request.headers.get('cookie') || '';
  const gaMatch = cookies.match(/_ga=GA\d+\.\d+\.(\d+\.\d+)/);
  if (gaMatch) return gaMatch[1];

  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000000);
  return `${random}.${timestamp}`;
}

async function sendToGA4(
  request: Request,
  context: Context,
  pathname: string
): Promise<void> {
  if (!GA_API_SECRET) return;

  const clientId = getClientId(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  // https://docs.netlify.com/build/user-agent-categories/
  const agentCategory = request.headers.get('netlify-agent-category') || 'none';
  const isAITool = agentCategory.startsWith('ai-agent');
  const isGenericBot = agentCategory.startsWith('crawler');

  const payload = {
    client_id: clientId,
    events: [
      {
        name: 'server_page_view',
        params: {
          page_location: request.url,
          page_title: pathname,
          page_path: pathname,
          content_type: 'text/html',
          file_extension: '.html',
          user_agent: userAgent,
          is_ai_tool: isAITool ? 'true' : 'false',
          is_bot: isGenericBot ? 'true' : 'false',
          country: context.geo?.country?.code || 'unknown',
        },
      },
    ],
  };

  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

  try {
    await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to send to GA4:', error);
  }
}

/**
 * Paths that should be served by the Next.js app instead of Framer.
 * Everything else is proxied to Framer (or the blog site if configured).
 */
const nextjsPaths = new Set([
  // When BLOG_URL is set, blog/changelog are proxied to the
  // standalone blog site instead of falling through to Next.js.
  ...(blogUrl ? [] : ['/blog', '/changelog']),
  '/courses',
  '/pricing',
  '/podcast',
  '/ai-chat',
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

  if (nextjsPaths.has(pathname)) return context.next();

  // Blog/changelog routing: proxy to standalone blog site, or fall through to Next.js.
  const isBlogPath =
    pathname === '/blog' ||
    pathname.startsWith('/blog/') ||
    pathname === '/changelog' ||
    pathname.startsWith('/changelog/');

  if (isBlogPath && !blogUrl) return context.next();

  if (isBlogPath && blogUrl) {
    const blogDestination = new URL(pathname, blogUrl);
    url.searchParams.forEach((value, key) => {
      blogDestination.searchParams.set(key, value);
    });

    const response = await fetch(blogDestination.toString(), {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || '',
        Accept: request.headers.get('Accept') || 'text/html',
        'Accept-Language': request.headers.get('Accept-Language') || '',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    context.waitUntil(sendToGA4(request, context, pathname));

    const newHeaders = new Headers(response.headers);
    newHeaders.set('x-nx-edge-function', 'blog-proxy');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('Content-Security-Policy', "frame-ancestors 'none'");
    // Edge CDN cache — stale-while-revalidate serves instantly while revalidating in background
    newHeaders.set(
      'Netlify-CDN-Cache-Control',
      'public, max-age=3600, stale-while-revalidate=86400'
    );
    if (isHtml) {
      // Content-Length is invalid after streaming rewrite changes body size
      newHeaders.delete('Content-Length');
    }

    return new Response(
      isHtml
        ? streamWithRewrite(response, blogUrl, 'https://nx.dev')
        : response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      }
    );
  }

  if (!framerUrl) return context.next();

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

  context.waitUntil(sendToGA4(request, context, pathname));

  const newHeaders = new Headers(response.headers);
  newHeaders.set('x-nx-edge-function', 'framer-proxy');
  newHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  // Edge CDN cache — stale-while-revalidate serves instantly while revalidating in background
  newHeaders.set(
    'Netlify-CDN-Cache-Control',
    'public, max-age=3600, stale-while-revalidate=86400'
  );
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('Content-Security-Policy', "frame-ancestors 'none'");
  // Content-Length is invalid after streaming rewrite changes body size
  newHeaders.delete('Content-Length');

  return new Response(
    streamWithRewrite(response, framerUrl, 'https://nx.dev'),
    {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    }
  );
}

export const config = {
  path: ['/*'],
  // Only process HTML requests to save on compute
  accept: ['text/html'],
  excludedPath: [
    '/docs',
    '/docs/*',
    '/api/*',
    '/courses/*',
    '/_next/*',
    '/.netlify/*',
    // Legacy docs paths — must bypass Framer so _redirects 301 rules fire
    '/ci',
    '/ci/*',
    '/cli',
    '/cli/*',
    '/code-owners',
    '/concepts',
    '/concepts/*',
    '/configuration',
    '/configuration/*',
    '/core-features',
    '/core-features/*',
    '/deprecated',
    '/deprecated/*',
    '/examples',
    '/examples/*',
    '/executors',
    '/executors/*',
    '/extending-nx',
    '/extending-nx/*',
    '/features',
    '/features/*',
    '/generators',
    '/generators/*',
    '/getting-started',
    '/getting-started/*',
    '/guides',
    '/guides/*',
    '/migration',
    '/migration/*',
    '/module-federation',
    '/module-federation/*',
    '/nx-api',
    '/nx-api/*',
    '/nx-enterprise',
    '/nx-enterprise/*',
    '/packages',
    '/packages/*',
    '/plugin-registry',
    '/powerpack',
    '/powerpack/*',
    '/recipe',
    '/recipe/*',
    '/recipes',
    '/recipes/*',
    '/reference',
    '/reference/*',
    '/see-also',
    '/see-also/*',
    '/showcase',
    '/showcase/*',
    '/structure',
    '/structure/*',
    '/technologies',
    '/technologies/*',
    '/troubleshooting',
    '/troubleshooting/*',
    '/using-nx',
    '/using-nx/*',
    '/ai',
    '/advent-of-code',
    '/launch-nx',
    '/terminal-ui',
    '/pricing/special-offer',
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
