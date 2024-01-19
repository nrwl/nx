export async function getResponseFromAI(prompt: string) {
  const axios = require('axios');

  try {
    const response = await axios.post(
      'https://nx-dev-git-fork-mandarini-feat-embeddings-for-api-nrwl.vercel.app/api/nx-command-handler',
      {
        query: prompt,
      }
    );
    console.log('Katerina KATERINA', response.data);
    return response.data;
  } catch (error) {
    console.error('Error calling Next.js edge function:', error);
    throw error;
  }
}
