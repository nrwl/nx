export async function openAiAPICall(
  input: object,
  action: 'moderation' | 'embedding' | 'chatCompletion',
  openAiKey: string
) {
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

  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}
