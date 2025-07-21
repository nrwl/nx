import {
  ChatItem,
  CustomError,
  DEFAULT_MATCH_COUNT,
  DEFAULT_MATCH_THRESHOLD,
  getLastAssistantMessageContent,
  getUserQuery,
  MIN_CONTENT_LENGTH,
  PageSection,
} from '@nx/nx-dev-util-ai';
import { getOpenAI, getSupabaseClient } from '@nx/nx-dev-util-ai';
import { SupabaseClient } from '@supabase/supabase-js';
import GPT3Tokenizer from 'gpt3-tokenizer';
import OpenAI from 'openai';

const supabaseUrl = process.env['NX_NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['NX_SUPABASE_SERVICE_ROLE_KEY'];
const openAiKey = process.env['NX_OPENAI_KEY'];
const tokenCountLimit =
  parseInt(process.env['NX_TOKEN_COUNT_LIMIT'] ?? '500') > 0
    ? parseInt(process.env['NX_TOKEN_COUNT_LIMIT'] ?? '500')
    : 500;

export async function getTokenizedContext(
  messages: ChatItem[]
): Promise<{ contextText: string; pageSections: PageSection[] }> {
  const openai = getOpenAI(openAiKey);
  const supabaseClient: SupabaseClient<any, 'public', any> = getSupabaseClient(
    supabaseUrl,
    supabaseServiceKey
  );

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

  return { contextText, pageSections };
}
