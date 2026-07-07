import { KNOWLEDGE_BASE_ID, PYLON_API_BASE } from './config';

export interface PylonArticle {
  id: string;
  title: string;
  slug: string;
  url: string;
  collection_id?: string;
  is_published: boolean;
  is_unlisted?: boolean;
  current_published_content_html?: string;
  current_draft_content_html?: string;
  visibility_config?: { visibility?: string };
  last_published_at?: string;
}

export interface CreateArticleInput {
  title: string;
  author_user_id: string;
  body_html: string;
  slug?: string;
  collection_id?: string;
  is_published?: boolean;
  is_unlisted?: boolean;
  visibility_config?: { visibility?: string };
}

export interface PylonCollection {
  id: string;
  title: string;
  slug?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

function getToken(): string {
  const token = process.env.PYLON_API_TOKEN;
  if (!token) {
    throw new Error('PYLON_API_TOKEN environment variable is not set');
  }
  return token;
}

async function request<T>(
  method: string,
  apiPath: string,
  body?: unknown
): Promise<T> {
  const url = `${PYLON_API_BASE}${apiPath}`;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : 2 ** attempt * 2000;
        lastError = new Error(
          `Pylon API ${method} ${apiPath} returned ${response.status}`
        );
        if (attempt < MAX_RETRIES) {
          await sleep(delayMs);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Pylon API ${method} ${apiPath} failed with ${response.status}: ${text.slice(0, 500)}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === 'AbortError') {
        lastError = new Error(`Pylon API ${method} ${apiPath} timed out`);
      }
      if (attempt < MAX_RETRIES) {
        await sleep(2 ** attempt * 2000);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error('unreachable');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listArticles(
  kbId: string = KNOWLEDGE_BASE_ID
): Promise<PylonArticle[]> {
  const articles: PylonArticle[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: '500' });
    if (cursor) query.set('cursor', cursor);
    const response = await request<{
      data: PylonArticle[];
      pagination?: { cursor?: string; has_next_page?: boolean };
    }>('GET', `/knowledge-bases/${kbId}/articles?${query}`);
    articles.push(...(response.data ?? []));
    cursor = response.pagination?.has_next_page
      ? response.pagination.cursor
      : undefined;
  } while (cursor);
  return articles;
}

export async function getArticle(
  articleId: string,
  kbId: string = KNOWLEDGE_BASE_ID
): Promise<PylonArticle> {
  const response = await request<{ data: PylonArticle }>(
    'GET',
    `/knowledge-bases/${kbId}/articles/${articleId}`
  );
  return response.data;
}

export async function createArticle(
  input: CreateArticleInput,
  kbId: string = KNOWLEDGE_BASE_ID
): Promise<PylonArticle> {
  const response = await request<{ data: PylonArticle }>(
    'POST',
    `/knowledge-bases/${kbId}/articles`,
    input
  );
  return response.data;
}

export async function updateArticle(
  articleId: string,
  input: Partial<CreateArticleInput>,
  kbId: string = KNOWLEDGE_BASE_ID
): Promise<PylonArticle> {
  const response = await request<{ data: PylonArticle }>(
    'PATCH',
    `/knowledge-bases/${kbId}/articles/${articleId}`,
    input
  );
  return response.data;
}

export async function deleteArticle(
  articleId: string,
  kbId: string = KNOWLEDGE_BASE_ID
): Promise<void> {
  await request('DELETE', `/knowledge-bases/${kbId}/articles/${articleId}`);
}

export async function listCollections(
  kbId: string = KNOWLEDGE_BASE_ID
): Promise<PylonCollection[]> {
  const response = await request<{ data: PylonCollection[] }>(
    'GET',
    `/knowledge-bases/${kbId}/collections`
  );
  return response.data ?? [];
}

export async function getMe(): Promise<{ id: string; email?: string }> {
  const response = await request<{ data: { id: string; email?: string } }>(
    'GET',
    '/me'
  );
  return response.data;
}

/**
 * Upload a binary via POST /attachments and get back a long-lived signed
 * CDN URL (assets.usepylon.com) embeddable in body_html.
 */
export async function uploadFile(
  fileName: string,
  bytes: Buffer,
  contentType: string
): Promise<{ url: string }> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    fileName
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${PYLON_API_BASE}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Pylon file upload failed with ${response.status}: ${text.slice(0, 500)}`
      );
    }
    const json = (await response.json()) as { data: { url: string } };
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}
