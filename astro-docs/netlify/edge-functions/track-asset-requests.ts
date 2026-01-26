import type { Context } from 'https://edge.netlify.com';

// Configuration - set these in Netlify environment variables
const GA_MEASUREMENT_ID =
  Netlify.env.get('GA_MEASUREMENT_ID') || 'G-XXXXXXXXXX';
const GA_API_SECRET = Netlify.env.get('GA_API_SECRET') || '';

function getClientId(request: Request): string {
  // Try to extract existing GA client ID from cookie
  const cookies = request.headers.get('cookie') || '';
  const gaMatch = cookies.match(/_ga=GA\d+\.\d+\.(\d+\.\d+)/);
  if (gaMatch) {
    return gaMatch[1];
  }

  // Generate a new client ID for this request
  // For non-browser clients (AI tools), this creates a session-based ID
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

  // Detect AI tools from user agent
  const isAITool =
    /bot|crawler|spider|gpt|claude|anthropic|openai|perplexity|cohere/i.test(
      userAgent
    );

  const payload = {
    client_id: clientId,
    events: [
      {
        name: 'page_view',
        params: {
          page_location: request.url,
          page_title: pathname,
          page_path: pathname,
          // Custom parameters for filtering
          file_extension: pathname.substring(pathname.lastIndexOf('.')),
          user_agent: userAgent,
          is_ai_tool: isAITool ? 'true' : 'false',
          country: context.geo?.country?.code || 'unknown',
        },
      },
    ],
  };

  console.log(`Tracked asset path: ${pathname}`);

  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

  try {
    await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Log but don't fail the request
    console.error('Failed to send to GA4:', error);
  }
}

export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Send analytics in background (non-blocking)
  context.waitUntil(sendToGA4(request, context, pathname));

  // Continue to serve the actual file
  const response = await context.next();

  // Add header to indicate edge function processed this request
  response.headers.set('x-nx-edge-function', 'track-asset-requests');

  return response;
}

export const config = {
  // Track all .txt and .md requests for AI/LLM usage analytics
  path: ['/*.txt', '/**/*.txt', '/*.md', '/**/*.md'],
};
