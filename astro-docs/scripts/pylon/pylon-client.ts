/**
 * Minimal REST client for the Pylon API, scoped to what the knowledge base sync
 * needs. Spec: https://static.usepylon.com/openapi.json
 */

const API_BASE = 'https://api.usepylon.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

/**
 * Requests per minute each endpoint documents in
 * https://static.usepylon.com/openapi.json. Pacing is per bucket because the
 * limits differ by an order of magnitude, and a first sync issues hundreds of
 * writes.
 */
const RATE_LIMITS = {
  articleCreate: 10,
  articleUpdate: 20,
  articleDelete: 20,
  articleList: 20,
  attachmentCreate: 10,
} as const;

type RateBucket = keyof typeof RATE_LIMITS;

/** Keeps pacing just inside the documented ceiling rather than exactly on it. */
const RATE_LIMIT_MARGIN = 1.05;

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
  #lastRequestAt = new Map<RateBucket, number>();

  constructor(options: { token: string; knowledgeBaseId: string }) {
    this.#token = options.token;
    this.#knowledgeBaseId = options.knowledgeBaseId;
  }

  async #request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      formData?: FormData;
      bucket: RateBucket;
      /**
       * False for requests that may commit server side even when the response
       * is lost. Those are retried only when the API states it rejected them.
       */
      idempotent?: boolean;
    }
  ): Promise<T> {
    const { body, formData, bucket, idempotent = true } = options;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(2 ** (attempt - 1) * 1000);
      await this.#throttle(bucket);

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
        // A timeout or socket error says nothing about whether the server
        // acted on the request, so a non-idempotent call must not be repeated.
        lastError = new Error(
          `${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`
        );
        if (!idempotent) throw lastError;
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

      // 429 is the one failure that proves the request was rejected rather
      // than applied, so repeating it is safe whatever the method.
      if (response.status !== 429 && !idempotent) throw lastError;

      const retryAfter = Number(response.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        await sleep(retryAfter * 1000);
      }
    }

    throw lastError ?? new Error('unreachable');
  }

  /** Paces each endpoint to the rate its documentation allows. */
  async #throttle(bucket: RateBucket): Promise<void> {
    const intervalMs = (60_000 / RATE_LIMITS[bucket]) * RATE_LIMIT_MARGIN;
    const waitMs =
      (this.#lastRequestAt.get(bucket) ?? 0) + intervalMs - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    this.#lastRequestAt.set(bucket, Date.now());
  }

  async getAuthenticatedUserId(): Promise<string> {
    const response = await this.#request<{ data: { user: { id: string } } }>(
      'GET',
      '/me',
      { bucket: 'articleList' }
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
      }>('GET', `/knowledge-bases/${this.#knowledgeBaseId}/articles?${query}`, {
        bucket: 'articleList',
      });
      articles.push(...(response.data ?? []));
      cursor = response.pagination?.has_next_page
        ? response.pagination.cursor
        : undefined;
    } while (cursor);

    return articles;
  }

  /**
   * Not retried on an ambiguous failure. A lost response for a committed
   * create would duplicate the article; leaving it for the next run to
   * reconcile by slug is the safer recovery.
   */
  async createArticle(input: CreateArticleInput): Promise<PylonArticle> {
    const response = await this.#request<{ data: PylonArticle }>(
      'POST',
      `/knowledge-bases/${this.#knowledgeBaseId}/articles`,
      { body: input, bucket: 'articleCreate', idempotent: false }
    );
    return response.data;
  }

  async updateArticle(
    articleId: string,
    input: UpdateArticleInput
  ): Promise<PylonArticle> {
    const response = await this.#request<{ data: PylonArticle }>(
      'PATCH',
      `/knowledge-bases/${this.#knowledgeBaseId}/articles/${articleId}`,
      { body: input, bucket: 'articleUpdate' }
    );
    return response.data;
  }

  async deleteArticle(articleId: string): Promise<void> {
    await this.#request(
      'DELETE',
      `/knowledge-bases/${this.#knowledgeBaseId}/articles/${articleId}`,
      { bucket: 'articleDelete' }
    );
  }

  /** Uploads a binary and returns a long-lived CDN URL usable in body_html. */
  async uploadAttachment(
    fileName: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<string> {
    const form = new FormData();
    // Copied into a plain Uint8Array because a Node Buffer's backing store is
    // not the ArrayBuffer that Blob requires.
    form.append(
      'file',
      new Blob([new Uint8Array(bytes)], { type: contentType }),
      fileName
    );
    // Retried like any other request: a duplicate upload only leaves an unused
    // file behind, and the URL that gets embedded is the one returned here.
    const response = await this.#request<{ data: { url: string } }>(
      'POST',
      '/attachments',
      { formData: form, bucket: 'attachmentCreate' }
    );
    return response.data.url;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
