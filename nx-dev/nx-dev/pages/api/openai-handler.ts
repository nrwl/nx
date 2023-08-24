import { NextRequest } from 'next/server';

const openAiKey = process.env['NX_OPENAI_KEY'];
export const config = {
  runtime: 'edge',
};

export default async function handler(request: NextRequest) {
  const { action, input } = await request.json();

  let apiUrl = 'https://api.openai.com/v1/';

  if (action === 'embedding') {
    apiUrl += 'embeddings';
  } else if (action === 'chatCompletion') {
    apiUrl += 'chat/completions';
  } else if (action === 'moderation') {
    apiUrl += 'moderations';
  } else {
    return new Response('Invalid action', { status: 400 });
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const responseData = await response.json();

    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: {
        'content-type': 'application/json',
      },
    });
  } catch (e) {
    console.error('Error processing the request:', e.message);
    return new Response(e.message, { status: 500 });
  }
}
