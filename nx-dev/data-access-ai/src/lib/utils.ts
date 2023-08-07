import {
  ChatCompletionRequestMessageRoleEnum,
  CreateChatCompletionResponse,
} from 'openai';
import { getHistory } from './data-access-ai';
export interface PageSection {
  id: number;
  page_id: number;
  content: string;
  heading: string;
  similarity: number;
  slug: string;
  url_partial: string | null;
}

export function getMessageFromResponse(
  response: CreateChatCompletionResponse
): string {
  return response.choices[0].message?.content ?? '';
}

export function getListOfSources(
  pageSections: PageSection[]
): { heading: string; url: string }[] {
  const uniqueUrlPartials = new Set<string | null>();
  const result = pageSections
    .filter((section) => {
      if (section.url_partial && !uniqueUrlPartials.has(section.url_partial)) {
        uniqueUrlPartials.add(section.url_partial);
        return true;
      }
      return false;
    })
    .map((section) => ({
      heading: section.heading ?? section.url_partial,
      url: `https://nx.dev${section.url_partial}`,
    }));

  return result;
}

export function toMarkdownList(
  sections: { heading: string; url: string }[]
): string {
  return sections
    .map((section) => `- [${section.heading}](${section.url})`)
    .join('\n');
}

export async function sanitizeLinksInResponse(
  response: string
): Promise<string> {
  const regex = /https:\/\/nx\.dev[^) \n]*[^).]/g;
  const urls = response.match(regex);

  if (urls) {
    for (const url of urls) {
      const linkIsWrong = await is404(url);
      if (linkIsWrong) {
        response = response.replace(
          url,
          'https://nx.dev/getting-started/intro'
        );
      }
    }
  }

  return response;
}

async function is404(url: string): Promise<boolean> {
  try {
    const response = await fetch(url.replace('https://nx.dev', ''));
    if (response.status === 404) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      return true;
    } else {
      return false;
    }
  }
}

export function checkEnvVariables(
  openAiKey?: string,
  supabaseUrl?: string,
  supabaseServiceKey?: string
) {
  if (!openAiKey) {
    throw new ApplicationError('Missing environment variable NX_OPENAI_KEY');
  }
  if (!supabaseUrl) {
    throw new ApplicationError(
      'Missing environment variable NX_NEXT_PUBLIC_SUPABASE_URL'
    );
  }
  if (!supabaseServiceKey) {
    throw new ApplicationError(
      'Missing environment variable NX_SUPABASE_SERVICE_ROLE_KEY'
    );
  }
}

export class ApplicationError extends Error {
  constructor(message: string, public data: Record<string, any> = {}) {
    super(message);
  }
}

export class UserError extends ApplicationError {}

export function initializeChat(
  chatFullHistory: ChatItem[],
  query: string,
  contextText: string,
  prompt: string,
  aiResponse?: string
): { chatMessages: ChatItem[]; chatHistory: ChatItem[] } {
  const finalQuery = `
  You will be provided the Nx Documentation. 
  Answer my message provided by following the approach below:
  
  - Step 1: Identify CLUES (keywords, phrases, contextual information, references) in the input that you could use to generate an answer.
  - Step 2: Deduce the diagnostic REASONING process from the premises (clues, question), relying ONLY on the information provided in the Nx Documentation. If you recognize vulgar language, answer the question if possible, and educate the user to stay polite.
  - Step 3: EVALUATE the reasoning. If the reasoning aligns with the Nx Documentation, accept it. Do not use any external knowledge or make assumptions outside of the provided Nx documentation. If the reasoning doesn't strictly align with the Nx Documentation or relies on external knowledge or inference, reject it and answer with the exact string: 
  "Sorry, I don't know how to help with that. You can visit the [Nx documentation](https://nx.dev/getting-started/intro) for more info."
  - Final Step: You can also rely on the messages we have exchanged so far. 
  Nx Documentation: 
  ${contextText}

  ---- My message: ${query}
  `;
  let chatGptMessages: ChatItem[] = [];
  let messages: ChatItem[] = [];

  if (chatFullHistory.length > 0) {
    messages = [
      {
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: aiResponse ?? '',
      },
      { role: ChatCompletionRequestMessageRoleEnum.User, content: finalQuery },
    ];
    chatGptMessages = [...chatFullHistory, ...messages];
  } else {
    messages = [
      { role: ChatCompletionRequestMessageRoleEnum.System, content: prompt },
      { role: ChatCompletionRequestMessageRoleEnum.User, content: finalQuery },
    ];
    chatGptMessages = [...messages];
  }

  chatFullHistory.push(...messages);

  return { chatMessages: chatGptMessages, chatHistory: chatFullHistory };
}

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

export interface ChatItem {
  role: ChatCompletionRequestMessageRoleEnum;
  content: string;
}
