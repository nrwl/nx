import { NextRequest } from 'next/server';
import {
  ChatItem,
  CustomError,
  getSupabaseClient,
  getLastAssistantMessageContent,
  getOpenAI,
  getUserQuery,
  extractErrorMessage,
} from '@nx/nx-dev/util-ai';
import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env['NX_NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['NX_SUPABASE_SERVICE_ROLE_KEY'];
const openAiKey = process.env['NX_OPENAI_KEY'];

export const config = {
  runtime: 'edge',
};

export default async function handler(request: NextRequest) {
  try {
    const openai = getOpenAI(openAiKey);
    const supabaseClient: SupabaseClient<any, 'public', any> =
      getSupabaseClient(supabaseUrl, supabaseServiceKey);

    const { messages } = (await request.json()) as { messages: ChatItem[] };

    const query: string | null = getUserQuery(messages);
    const sanitizedQuery = query.trim();

    const embeddingResponse: OpenAI.Embeddings.CreateEmbeddingResponse =
      await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: sanitizedQuery + getLastAssistantMessageContent(messages),
      });

    console.log('sanitizedQuery', sanitizedQuery);

    const {
      data: [{ embedding }],
    } = embeddingResponse;

    const { error: matchError, data: pageSections } = await supabaseClient.rpc(
      'match_api_docs_reference',
      {
        embedding,
        match_threshold: DEFAULT_MATCH_THRESHOLD,
        match_count: DEFAULT_MATCH_COUNT,
        min_content_length: MIN_CONTENT_LENGTH,
      }
    );

    if (matchError) {
      throw new CustomError(
        'application_error',
        'Failed to find docs about this.',
        matchError
      );
    }

    if (!pageSections || pageSections.length === 0) {
      throw new CustomError('user_error', 'No results found.', {
        no_results: true,
      });
    }

    let contextText = '';

    const content = pageSections?.[0].content;

    contextText += `${content.trim()}\n---\n`;

    const { chatMessages } = initializeChat(
      messages,
      query,
      contextText,
      PROMPT
    );

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: chatMessages,
      temperature: 0,
      stream: false,
    });

    return response;
  } catch (err: unknown) {
    console.error('Error: ', err);
    const errorResponse = extractErrorMessage(err);
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'content-type': 'application/json',
      },
    });
  }
}

export function initializeChat(
  messages: ChatItem[],
  query: string,
  contextText: string,
  prompt: string
): { chatMessages: ChatItem[] } {
  const finalQuery = `
You will be provided a page from the Nx API. You have to use that page
to return a command the user must run to achieve what they want.

Sections:
${contextText}

Question: """
${query}
"""

The command should be ready to be put into the terminal, so ONLY return the command.
    `;

  // Remove the last message, which is the user query
  // and restructure the user query to include the instructions and context.
  // Add the system prompt as the first message of the array
  // and add the user query as the last message of the array.
  messages.pop();
  messages = [
    { role: 'system', content: prompt },
    ...(messages ?? []),
    { role: 'user', content: finalQuery },
  ];

  return { chatMessages: messages };
}

export const DEFAULT_MATCH_THRESHOLD = 0.78;
export const DEFAULT_MATCH_COUNT = 15;
export const MIN_CONTENT_LENGTH = 50;

export const PROMPT = `
${`
You are a knowledgeable Nx representative. You can answer queries using ONLY information in the provided documentation, and do not include your own knowledge or experience.
Your answer should adhere to the following rules:
- If you are unsure and cannot find an answer in the documentation, do not reply with anything other than, "Sorry, I don't know how to help with that. You can visit the [Nx documentation](https://nx.dev/getting-started/intro) for more info."
- If you recognize vulgar language, answer the question if possible, and educate the user to stay polite.
- Do not contradict yourself in the answer.
- Do not use any external knowledge or make assumptions outside of the provided the documentation. 
- wherever you see "@nrwl" replace with "@nx".

Remember, answer the question using ONLY the information provided in the documentation.
The format the command uses is the following:

For executors, to run tasks:
nx <target name> <project name> <options>

For generators, to generate code or create new things:

nx g @nx/<plugin-name>:<generator-name> <options>

Only reply in this format. Only the command.

`
  .replace(/\s+/g, ' ')
  .trim()}
`;
