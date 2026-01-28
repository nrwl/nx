import type { Context } from 'https://edge.netlify.com';

/**
 * Netlify Edge Function to add HTTP Link headers to docs pages.
 * This advertises the availability of raw markdown and LLM-friendly resources.
 *
 * Headers added:
 * - Link to .md version of current page
 * - Link to llms.txt (documentation index)
 * - Link to llms-full.txt (concatenated full docs)
 *
 * See: https://llmstxt.org/
 */
export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  // Early exit: Only process requests that want HTML (saves edge function costs)
  // Browsers and HTML-consuming tools send Accept: text/html
  const acceptHeader = request.headers.get('accept') || '';
  if (!acceptHeader.includes('text/html')) {
    return context.next();
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip non-page paths (assets, API endpoints, etc.)
  if (
    pathname.endsWith('.md') ||
    pathname.endsWith('.txt') ||
    pathname.includes('/og/') ||
    pathname.includes('/_') ||
    pathname.includes('/assets/')
  ) {
    return context.next();
  }

  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  // e.g. /docs/getting-started/intro -> /docs/getting-started/intro.md
  const mdPath = pathname.replace(/\/?$/, '.md');

  const linkHeader = [
    `<${mdPath}>; rel="alternate"; type="text/markdown"`,
    `</docs/llms.txt>; rel="alternate"; type="text/markdown"; title="LLM Index"`,
    `</docs/llms-full.txt>; rel="alternate"; type="text/markdown"; title="Full Documentation"`,
  ].join(', ');

  // Netlify Edge Function responses are immutable, so create a new Response
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
};
