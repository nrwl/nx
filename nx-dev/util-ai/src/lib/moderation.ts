import OpenAI from 'openai';
import { CustomError } from './utils';

export async function moderateContent(sanitizedQuery: string, openai: OpenAI) {
  try {
    const moderationResponse = await openai.moderations.create({
      input: sanitizedQuery,
    });

    const [results] = moderationResponse.results;

    if (results.flagged) {
      throw new CustomError('user_error', 'Flagged content', {
        flagged: true,
        categories: results.categories,
      });
    }
  } catch (e) {
    console.error('Error when moderating content: ', e);
  }
}
