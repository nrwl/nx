import { CreateCompletionResponseUsage } from 'openai';
import { MAX_HISTORY_LENGTH, ChatItem } from '@nx/nx-dev/util-ai';
import { getChatResponse } from './utils';

let chatFullHistory: ChatItem[] = [];

let totalTokensSoFar = 0;

export async function queryAi(
  query: string,
  aiResponse?: string
): Promise<{
  textResponse: string;
  usage?: CreateCompletionResponseUsage;
  sources: { heading: string; url: string }[];
  sourcesMarkdown: string;
}> {
  if (chatFullHistory.length > MAX_HISTORY_LENGTH) {
    chatFullHistory.slice(0, MAX_HISTORY_LENGTH - 4);
  }

  try {
    const responseObj = await getChatResponse(
      query,
      chatFullHistory,
      aiResponse
    );

    if (!responseObj.ok) {
      throw await responseObj.json();
    }

    const response: {
      textResponse: string;
      usage?: CreateCompletionResponseUsage;
      sources: { heading: string; url: string }[];
      sourcesMarkdown: string;
      chatHistory: ChatItem[];
      requestTokens: number;
    } = await responseObj.json();

    totalTokensSoFar += response.requestTokens;
    chatFullHistory = response.chatHistory;

    return response;
  } catch (e: any) {
    console.error('Error: ', e?.['message'] || e);
    throw e;
  }
}

export function resetHistory() {
  chatFullHistory = [];
  totalTokensSoFar = 0;
}

export function getHistory(): ChatItem[] {
  return chatFullHistory;
}
