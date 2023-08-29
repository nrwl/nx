// based on:
// https://github.com/supabase-community/nextjs-openai-doc-search/blob/main/pages/api/vector-search.ts

import { NextRequest } from 'next/server';
import {
  CustomError,
  DEFAULT_MATCH_COUNT,
  DEFAULT_MATCH_THRESHOLD,
  MIN_CONTENT_LENGTH,
  PROMPT,
  PageSection,
  checkEnvVariables,
  getListOfSources,
  getMessageFromResponse,
  initializeChat,
  moderateContent,
  openAiAPICall,
  sanitizeLinksInResponse,
  toMarkdownList,
} from '@nx/nx-dev/util-ai';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { CreateCompletionResponseUsage, CreateEmbeddingResponse } from 'openai';
import GPT3Tokenizer from 'gpt3-tokenizer';

const supabaseUrl = process.env['NX_NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['NX_SUPABASE_SERVICE_ROLE_KEY_ACTUAL'];
const openAiKey = process.env['NX_OPENAI_KEY'];

export const config = {
  runtime: 'edge',
};

export default async function handler(request: NextRequest) {
  try {
    checkEnvVariables(openAiKey, supabaseUrl, supabaseServiceKey);
    const { query, aiResponse, chatFullHistory } = await request.json();

    const supabaseClient: SupabaseClient<any, 'public', any> = createClient(
      supabaseUrl as string,
      supabaseServiceKey as string
    );

    if (!query) {
      throw new CustomError('user_error', 'Missing query in request data', {
        missing_query: true,
      });
    }

    // Moderate the content to comply with OpenAI T&C
    const sanitizedQuery = query.trim();

    await moderateContent(sanitizedQuery, openAiKey as string);

    // Create embedding from query
    // NOTE: Here, we may or may not want to include the previous AI response
    /**
     * For retrieving relevant Nx documentation sections via embeddings, it's a design decision.
     * Including the prior response might give more contextually relevant sections,
     * but just sending the query might suffice for many cases.
     *
     * We can experiment with this.
     *
     * How the solution looks like with previous response:
     *
     *     const embeddingResponse = await openAiCall(
     *      { input: sanitizedQuery + aiResponse },
     *      'embedding'
     *     );
     *
     * This costs more tokens, so if we see costs skyrocket we remove it.
     * As it says in the docs, it's a design decision, and it may or may not really improve results.
     */
    const embeddingResponseObj = await openAiAPICall(
      { input: sanitizedQuery + aiResponse, model: 'text-embedding-ada-002' },
      'embedding',
      openAiKey as string
    );

    const embeddingResponse = await embeddingResponseObj.json();

    if (!embeddingResponseObj.ok) {
      throw new CustomError(
        'application_error',
        'Failed to create embedding for question',
        {
          data: embeddingResponse,
        }
      );
    }

    const {
      data: [{ embedding }],
    }: CreateEmbeddingResponse = embeddingResponse;

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

    // Note: this is experimental. I think it should work
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

      if (tokenCount >= 2500) {
        break;
      }

      contextText += `${content.trim()}\n---\n`;
    }

    const { chatMessages: chatGptMessages, chatHistory } = initializeChat(
      chatFullHistory,
      query,
      contextText,
      PROMPT,
      aiResponse
    );

    const responseObj = await openAiAPICall(
      {
        model: 'gpt-3.5-turbo-16k',
        messages: chatGptMessages,
        temperature: 0,
        stream: false,
      },
      'chatCompletion',
      openAiKey as string
    );

    const response = await responseObj.json();

    if (!responseObj.ok) {
      throw new CustomError(
        'application_error',
        'Failed to generate completion',
        {
          data: response,
        }
      );
    }
    // Message asking to double-check
    const callout: string =
      '{% callout type="warning" title="Always double-check!" %}The results may not be accurate, so please always double check with our documentation.{% /callout %}\n';
    // Append the warning message asking to double-check!
    const message = [callout, getMessageFromResponse(response)].join('');

    const responseWithoutBadLinks = await sanitizeLinksInResponse(message);

    const sources = getListOfSources(pageSections);

    const responseData = {
      textResponse: responseWithoutBadLinks,
      usage: response.usage as CreateCompletionResponseUsage,
      sources,
      sourcesMarkdown: toMarkdownList(sources),
      chatHistory,
      requestTokens: response.usage?.total_tokens,
    };
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  } catch (err: unknown) {
    console.error('Error: ', err);

    return new Response(
      JSON.stringify({
        ...JSON.parse(JSON.stringify(err)),
        message: err?.['message'],
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}
