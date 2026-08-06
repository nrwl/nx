/**
 * Minimal REST client for the Pylon API, scoped to what the knowledge base sync
 * needs. Spec: https://static.usepylon.com/openapi.json
 */

const API_BASE = 'https://api.usepylon.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

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
}

export interface CreateArticleInput {
  title: string;
  author_user_id: string;
  body_html: string;
  slug: string;
  collection_id: string;
  is_published: boolean;
  is_unlisted: boolean;
}

/**
 * PATCH accepts no slug or collection_id - those are fixed at creation time.
 * Content edits stay in draft unless publish_updated_body_html is set.
 */
export interface UpdateArticleInput {
  title?: string;
  body_html?: string;
  is_published?: boolean;
  is_unlisted?: boolean;
  publish_updated_body_html?: boolean;
}

export class PylonClient {
  #token: string;
  #knowledgeBaseId: string;
  #writeDelayMs: number;
  #lastWriteAt = 0;

  constructor(options: {
    token: string;
    knowledgeBaseId: string;
    writeDelayMs?: number;
  }) {
    this.#token = options.token;
    this.#knowledgeBaseId = options.knowledgeBaseId;
    this.#writeDelayMs = options.writeDelayMs ?? 250;
  }

  async #request<T>(
    method: string,
    path: string,
    body?: unknown,
    formData?: FormData
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(2 ** (attempt - 1) * 1000);

      let response: Response;
      try {
        response = await fetch(`${API_BASE}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.#token}`,
            ...(formData ? {} : { 'Content-Type': 'application/json' }),
          },
          body:
            formData ?? (body === undefined ? undefined : JSON.stringify(body)),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        // Timeouts and socket errors only - a completed HTTP response never
        // lands here, so everything caught is worth another attempt.
        lastError = new Error(
          `${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }

      if (response.ok) {
        const text = await response.text();
        return (text ? JSON.parse(text) : {}) as T;
      }

      const detail = (await response.text()).slice(0, 500);
      lastError = new Error(
        `${method} ${path} returned ${response.status}: ${detail}`
      );

      // 4xx other than throttling means the request itself is wrong.
      if (response.status !== 429 && response.status < 500) throw lastError;

      const retryAfter = Number(response.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        await sleep(retryAfter * 1000);
      }
    }

    throw lastError ?? new Error('unreachable');
  }

  /** Space out mutations so a 184-article run does not trip rate limits. */
  async #throttleWrite(): Promise<void> {
    const waitMs = this.#lastWriteAt + this.#writeDelayMs - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    this.#lastWriteAt = Date.now();
  }

  async getAuthenticatedUserId(): Promise<string> {
    const response = await this.#request<{ data: { user: { id: string } } }>(
      'GET',
      '/me'
    );
    return response.data.user.id;
  }

  async listArticles(): Promise<PylonArticle[]> {
    const articles: PylonArticle[] = [];
    let cursor: string | undefined;

    do {
      const query = new URLSearchParams({ limit: '500' });
      if (cursor) query.set('cursor', cursor);
      const response = await this.#request<{
        data: PylonArticle[];
        pagination?: { cursor?: string; has_next_page?: boolean };
      }>('GET', `/knowledge-bases/${this.#knowledgeBaseId}/articles?${query}`);
      articles.push(...(response.data ?? []));
      cursor = response.pagination?.has_next_page
        ? response.pagination.cursor
        : undefined;
    } while (cursor);

    return articles;
  }

  async createArticle(input: CreateArticleInput): Promise<PylonArticle> {
    await this.#throttleWrite();
    const response = await this.#request<{ data: PylonArticle }>(
      'POST',
      `/knowledge-bases/${this.#knowledgeBaseId}/articles`,
      input
    );
    return response.data;
  }

  async updateArticle(
    articleId: string,
    input: UpdateArticleInput
  ): Promise<PylonArticle> {
    await this.#throttleWrite();
    const response = await this.#request<{ data: PylonArticle }>(
      'PATCH',
      `/knowledge-bases/${this.#knowledgeBaseId}/articles/${articleId}`,
      input
    );
    return response.data;
  }

  async deleteArticle(articleId: string): Promise<void> {
    await this.#throttleWrite();
    await this.#request(
      'DELETE',
      `/knowledge-bases/${this.#knowledgeBaseId}/articles/${articleId}`
    );
  }

  /** Uploads a binary and returns a long-lived CDN URL usable in body_html. */
  async uploadAttachment(
    fileName: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<string> {
    await this.#throttleWrite();
    const form = new FormData();
    // Copied into a plain Uint8Array because a Node Buffer's backing store is
    // not the ArrayBuffer that Blob requires.
    form.append(
      'file',
      new Blob([new Uint8Array(bytes)], { type: contentType }),
      fileName
    );
    const response = await this.#request<{ data: { url: string } }>(
      'POST',
      '/attachments',
      undefined,
      form
    );
    return response.data.url;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
