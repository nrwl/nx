/**
 * POST /api/query-ai-embeddings
 *
 * Returns tokenized Nx docs context for a chat-style message list. Consumed by
 * the Nx MCP server (nx-console) for the nx_docs tool - the request/response
 * contract ({ messages } -> { context: { contextText, pageSections } }) must
 * be preserved.
 *
 * Express app wrapped as a Netlify Function (see the /api/* rewrite in
 * nx-dev/nx-dev/_redirects). Geo restrictions are enforced by the
 * api-geo-block edge function before requests reach this handler.
 *
 * Env vars: NX_OPENAI_KEY, NX_NEXT_PUBLIC_SUPABASE_URL,
 * NX_SUPABASE_SERVICE_ROLE_KEY, NX_TOKEN_COUNT_LIMIT (optional).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import GPT3Tokenizer from 'gpt3-tokenizer';
import OpenAI from 'openai';
import serverless from 'serverless-http';

const DEFAULT_MATCH_THRESHOLD = 0.78;
const DEFAULT_MATCH_COUNT = 15;
const MIN_CONTENT_LENGTH = 50;

interface ChatItem {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
}

interface PageSection {
  id: number;
  page_id: number;
  content: string;
  heading: string;
  longer_heading: string;
  similarity: number;
  slug: string;
  url_partial: string | null;
}

class CustomError extends Error {
  constructor(
    public type: string = 'application_error',
    message: string,
    public data: Record<string, any> = {}
  ) {
    super(message);
  }
}

let openai: OpenAI;
function getOpenAI(): OpenAI {
  if (openai) return openai;
  const key = process.env['NX_OPENAI_KEY'];
  if (!key) {
    throw new CustomError(
      'application_error',
      'Missing environment variable NX_OPENAI_KEY',
      { missing_key: true }
    );
  }
  openai = new OpenAI({ apiKey: key });
  return openai;
}

let supabaseClient: SupabaseClient;
function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  const url = process.env['NX_NEXT_PUBLIC_SUPABASE_URL'];
  const serviceKey = process.env['NX_SUPABASE_SERVICE_ROLE_KEY'];
  if (!url) {
    throw new CustomError(
      'application_error',
      'Missing environment variable NX_NEXT_PUBLIC_SUPABASE_URL',
      { missing_key: true }
    );
  }
  if (!serviceKey) {
    throw new CustomError(
      'application_error',
      'Missing environment variable NX_SUPABASE_SERVICE_ROLE_KEY',
      { missing_key: true }
    );
  }
  supabaseClient = createClient(url, serviceKey);
  return supabaseClient;
}

function getUserQuery(messages: ChatItem[]): string {
  const lastMessage = messages?.[messages.length - 1];
  if (lastMessage?.role === 'user' && lastMessage.content) {
    return lastMessage.content;
  }
  throw new CustomError('user_error', 'Missing query in request data', {
    missing_query: true,
  });
}

function getLastAssistantMessageContent(messages: ChatItem[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return messages[i].content;
  }
  return '';
}

async function getTokenizedContext(
  messages: ChatItem[]
): Promise<{ contextText: string; pageSections: PageSection[] }> {
  const tokenCountLimit =
    parseInt(process.env['NX_TOKEN_COUNT_LIMIT'] ?? '500') > 0
      ? parseInt(process.env['NX_TOKEN_COUNT_LIMIT'] ?? '500')
      : 500;

  const query = getUserQuery(messages).trim();

  // Include the previous response so the doc sections we get back stay
  // relevant across conversation turns.
  const embeddingResponse = await getOpenAI().embeddings.create({
    model: 'text-embedding-ada-002',
    input: query + getLastAssistantMessageContent(messages),
  });
  const {
    data: [{ embedding }],
  } = embeddingResponse;

  const { error: matchError, data: pageSections } =
    await getSupabaseClient().rpc('match_page_sections_2', {
      embedding,
      match_threshold: DEFAULT_MATCH_THRESHOLD,
      match_count: DEFAULT_MATCH_COUNT,
      min_content_length: MIN_CONTENT_LENGTH,
    });

  if (matchError) {
    throw new CustomError(
      'application_error',
      'Failed to match page sections',
      matchError
    );
  }
  if (!pageSections || pageSections.length === 0) {
    throw new CustomError('user_error', 'No results found.', {
      no_results: true,
    });
  }

  const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
  let tokenCount = 0;
  let contextText = '';
  for (const pageSection of pageSections as PageSection[]) {
    tokenCount += tokenizer.encode(pageSection.content).text.length;
    if (tokenCount >= tokenCountLimit) break;
    contextText += `${pageSection.content.trim()}\n---\n`;
  }

  return { contextText, pageSections };
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const queryAiEmbeddings: express.RequestHandler = async (req, res) => {
  try {
    const { messages } = req.body as { messages: ChatItem[] };
    if (!messages) {
      res.status(400).json({ error: 'Messages are required' });
      return;
    }
    const context = await getTokenizedContext(messages);
    res.status(200).json({ context });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal error' });
  }
};

// Mounted at both the public path (via the /api/* rewrite in _redirects) and
// the direct function path.
app.post('/api/query-ai-embeddings', queryAiEmbeddings);
app.post('/.netlify/functions/query-ai-embeddings', queryAiEmbeddings);

export const handler = serverless(app);
