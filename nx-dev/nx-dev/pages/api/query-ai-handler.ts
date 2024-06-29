import { NextRequest } from 'next/server';
import {
  ChatItem,
  CustomError,
  DEFAULT_MATCH_COUNT,
  DEFAULT_MATCH_THRESHOLD,
  MIN_CONTENT_LENGTH,
  PROMPT,
  PageSection,
  appendToStream,
  getSupabaseClient,
  formatMarkdownSources,
  getLastAssistantMessageContent,
  getOpenAI,
  getUserQuery,
  initializeChat,
  extractErrorMessage,
} from '@nx/nx-dev/util-ai';
import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import GPT3Tokenizer from 'gpt3-tokenizer';
import { Stream } from 'openai/streaming';

const supabaseUrl = process.env['NX_NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['NX_SUPABASE_SERVICE_ROLE_KEY'];
const openAiKey = process.env['NX_OPENAI_KEY'];
const tokenCountLimit =
  parseInt(process.env['NX_TOKEN_COUNT_LIMIT'] ?? '500') > 0
    ? parseInt(process.env['NX_TOKEN_COUNT_LIMIT'] ?? '500')
    : 500;

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
    const supabaseClient: SupabaseClient<any, 'public', any> =
      getSupabaseClient(supabaseUrl, supabaseServiceKey);

    const { messages } = (await request.json()) as { messages: ChatItem[] };

    const query: string | null = getUserQuery(messages);
    const sanitizedQuery = query.trim();

    // We include the previous response,
    // to make sure the embeddings (doc sections)
    // we get back are relevant.
    const embeddingResponse: OpenAI.Embeddings.CreateEmbeddingResponse =
      await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: sanitizedQuery + getLastAssistantMessageContent(messages),
      });

    const {
      data: [{ embedding }],
    } = embeddingResponse;

    // Based on:
    // https://github.com/supabase-community/nextjs-openai-doc-search/blob/main/pages/api/vector-search.ts
    const { error: matchError, data: pageSections } = await supabaseClient.rpc(
      'match_page_sections_2',
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
        'Failed to match page sections',
        matchError
      );
    }

    // Note: this is experimental and quite aggressive. I think it should work
    // mainly because we're testing previous response + query.
    if (!pageSections || pageSections.length === 0) {
      throw new CustomError('user_error', 'No results found.', {
        no_results: true,
      });
    }

    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
    let tokenCount = 0;
    let contextText = '';

    for (let i = 0; i < (pageSections as PageSection[]).length; i++) {
      const pageSection: PageSection = pageSections[i];
      const content = pageSection.content;
      const encoded = tokenizer.encode(content);
      tokenCount += encoded.text.length;

      if (tokenCount >= tokenCountLimit) {
        break;
      }

      contextText += `${content.trim()}\n---\n`;
    }

    const { chatMessages } = initializeChat(
      messages,
      query,
      contextText,
      PROMPT
    );

    const response: Stream<OpenAI.Chat.Completions.ChatCompletionChunk> =
      await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-16k',
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
