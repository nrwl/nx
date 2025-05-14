import {
  ChatItem,
  CustomError,
  PROMPT,
  appendToStream,
  extractErrorMessage,
  formatMarkdownSources,
  getOpenAI,
  getUserQuery,
  initializeChat,
} from '@nx/nx-dev/util-ai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Stream } from 'openai/streaming';
import { getTokenizedContext } from '../../lib/getTokenizedContext';

const openAiKey = process.env['NX_OPENAI_KEY'];

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

    const openai = getOpenAI(openAiKey);

    const { messages } = (await request.json()) as { messages: ChatItem[] };

    const query: string | null = getUserQuery(messages);

    const { contextText, pageSections } = await getTokenizedContext(messages);

    const { chatMessages } = initializeChat(
      messages,
      query,
      contextText,
      PROMPT
    );

    const response: Stream<OpenAI.Chat.Completions.ChatCompletionChunk> =
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: 0,
        stream: true,
      });

    const sourcesMarkdown = formatMarkdownSources(pageSections);
    const stream = OpenAIStream(response);
    const finalStream = await appendToStream(stream, sourcesMarkdown);

    return new StreamingTextResponse(finalStream);
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
