import { ChatCompletionRequestMessageRoleEnum } from 'openai';
import { getHistory } from './data-access-ai';
import { ChatItem } from '@nx/nx-dev/util-ai';

export function extractQuery(text: string) {
  const regex = /---- My message: (.+)/;
  const match = text.match(regex);
  return match ? match[1].trim() : text;
}

export function getProcessedHistory(): ChatItem[] {
  let history = getHistory();
  history = history
    .map((item) => {
      if (item.role === ChatCompletionRequestMessageRoleEnum.User) {
        item.content = extractQuery(item.content);
      }
      if (item.role !== ChatCompletionRequestMessageRoleEnum.System) {
        return item;
      } else {
        return undefined;
      }
    })
    .filter((item) => !!item) as ChatItem[];
  return history;
}

export function getChatResponse(
  query: string,
  chatFullHistory: ChatItem[],
  aiResponse?: string
): Promise<Response> {
  return fetch('/api/query-ai-handler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      chatFullHistory,
      aiResponse,
    }),
  });
}
