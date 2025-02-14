import { NextRequest } from 'next/server';
import { getTokenizedContext } from '../../lib/getTokenizedContext';
import { CustomError } from '@nx/nx-dev/util-ai';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: NextRequest) {
  const country = request.geo.country;
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
  try {
    if (restrictedCountries.includes(country)) {
      throw new CustomError(
        'user_error',
        'Service is not available in your region.'
      );
    }

    const { input } = await request.json();
    if (!input) {
      return new Response(JSON.stringify({ error: 'Input is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const context = await getTokenizedContext(input);
    return new Response(JSON.stringify({ context }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
