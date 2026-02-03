import type { Context } from 'https://edge.netlify.com';

const GA_MEASUREMENT_ID =
  Netlify.env.get('GA_MEASUREMENT_ID') || 'G-XXXXXXXXXX';
const GA_API_SECRET = Netlify.env.get('GA_API_SECRET') || '';

function shouldTrack(request: Request): boolean {
  const accept = request.headers.get('accept') || '';

  // Track if:
  // - No Accept header (some LLM tools)
  // - Accept contains text/html (browsers)
  // - Accept contains */* (curl, browser default)
  if (!accept || accept.includes('text/html') || accept.includes('*/*')) {
    return true;
  }

  // Skip image/css/js/font requests
  return false;
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
  if (!GA_API_SECRET) {
    console.warn('GA_API_SECRET not configured, skipping analytics');
    return;
  }

  const clientId = getClientId(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const isAITool =
    /bot|crawler|spider|gpt|claude|anthropic|openai|perplexity|cohere/i.test(
      userAgent
    );

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
          country: context.geo?.country?.code || 'unknown',
        },
      },
    ],
  };

  console.log(`Tracked HTML page: ${pathname}`);

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

export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  if (shouldTrack(request)) {
    context.waitUntil(sendToGA4(request, context, pathname));
  }

  const response = await context.next();
  const newHeaders = new Headers(response.headers);
  newHeaders.set('x-nx-edge-function', 'track-page-requests');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export const config = {
  path: ['/docs/*'],
  excludedPath: [
    // Text/code files (handled by track-asset-requests or not tracked)
    '/docs/*.md',
    '/docs/*.js',
    '/docs/*.txt',
    // Images
    '/docs/*.svg',
    '/docs/*.png',
    '/docs/*.jpg',
    '/docs/*.jpeg',
    '/docs/*.gif',
    '/docs/*.webp',
    '/docs/*.ico',
    '/docs/images/*',
    '/docs/og/*',
    // Fonts
    '/docs/fonts/*',
    '/docs/*.woff',
    '/docs/*.woff2',
    // Search index (pagefind)
    '/docs/pagefind/*',
    // Astro build assets
    '/docs/_*',
  ],
};
