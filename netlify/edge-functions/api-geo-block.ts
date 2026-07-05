import type { Context } from 'https://edge.netlify.com';

/**
 * Blocks /api/* requests from countries where the OpenAI-backed endpoints
 * cannot be offered. Runs before the query-ai-embeddings Netlify Function,
 * which has no geo information of its own. Mirrors the geo check the old
 * Next.js edge API routes performed via request.geo.
 */
const restrictedCountries: string[] = [
  'BY', // Belarus
  'CN', // China
  'CU', // Cuba
  'IR', // Iran
  'KP', // North Korea
  'RU', // Russia
  'SY', // Syria
  'VE', // Venezuela
];

export default async function handler(
  _request: Request,
  context: Context
): Promise<Response> {
  const country = context.geo?.country?.code ?? '';
  if (restrictedCountries.includes(country)) {
    return new Response(
      JSON.stringify({ error: 'Service is not available in your region.' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
  return context.next();
}

export const config = {
  path: '/api/*',
};
