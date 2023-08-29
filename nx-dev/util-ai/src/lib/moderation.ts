import { openAiAPICall } from './openai-call';
import { CustomError } from './utils';

export async function moderateContent(
  sanitizedQuery: string,
  openAiKey: string
) {
  const moderationResponseObj = await openAiAPICall(
    { input: sanitizedQuery },
    'moderation',
    openAiKey as string
  );

  const moderationResponse = await moderationResponseObj.json();
  const [results] = moderationResponse.results;

  if (results.flagged) {
    throw new CustomError('user_error', 'Flagged content', {
      flagged: true,
      categories: results.categories,
    });
  }
}
