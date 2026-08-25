import { PassThrough, Readable } from 'stream';

export interface HttpRequestConfig {
  method?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | null | undefined>;
  data?: unknown;
  timeout?: number;
  responseType?: 'json' | 'stream';
  signal?: AbortSignal;
}

export interface HttpResponse<T = any> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

export class HttpError extends Error {
  readonly status: number;

  constructor(readonly response: HttpResponse) {
    // Same message copy axios used, in case consumers match on it
    super(`Request failed with status code ${response.status}`);
    this.name = 'HttpError';
    this.status = response.status;
  }
}

export interface HttpClient {
  request<T = any>(
    url: string,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  get<T = any>(
    url: string,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  post<T = any>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
}

export function createHttpClient(defaults: HttpRequestConfig = {}): HttpClient {
  const merge = (config: HttpRequestConfig = {}): HttpRequestConfig => ({
    ...defaults,
    ...config,
    headers: {
      ...toLowerCaseKeys(defaults.headers),
      ...toLowerCaseKeys(config.headers),
    },
  });
  return {
    request: (url, config) => httpRequest(url, merge(config)),
    get: (url, config) => httpRequest(url, merge({ ...config, method: 'GET' })),
    post: (url, data, config) =>
      httpRequest(url, merge({ ...config, method: 'POST', data })),
  };
}

export async function httpRequest<T = any>(
  url: string,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<T>> {
  const fullUrl = buildFullUrl(url, config);
  const { fetchImpl, dispatcher } = resolveFetch();

  // Lowercase keys so differently-cased duplicates override instead of
  // sending both values
  const headers: Record<string, string> = toLowerCaseKeys(config.headers);
  let body: string | undefined;
  if (config.data !== undefined) {
    body = JSON.stringify(config.data);
    headers['content-type'] ??= 'application/json';
  }

  const controller = new AbortController();
  if (config.signal) {
    if (config.signal.aborted) {
      controller.abort(config.signal.reason);
    } else {
      config.signal.addEventListener(
        'abort',
        () => controller.abort(config.signal.reason),
        { once: true }
      );
    }
  }
  const timer = config.timeout
    ? setTimeout(
        () =>
          controller.abort(
            new DOMException(
              `Request timed out after ${config.timeout}ms`,
              'TimeoutError'
            )
          ),
        config.timeout
      )
    : null;

  let res: Response;
  try {
    res = await fetchImpl(fullUrl, {
      method: config.method ?? 'GET',
      headers,
      body,
      redirect: 'follow',
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
  } catch (e) {
    if (timer) clearTimeout(timer);
    throw e;
  }

  const responseHeaders = Object.fromEntries(res.headers.entries());

  if (config.responseType === 'stream') {
    if (!res.ok) {
      try {
        throw new HttpError({
          status: res.status,
          headers: responseHeaders,
          data: await parseResponseData(res),
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    // The headers timeout ends here; the body gets a per-chunk inactivity
    // guard instead, so slow-but-progressing downloads survive
    if (timer) clearTimeout(timer);
    return {
      status: res.status,
      headers: responseHeaders,
      data: (res.body
        ? guardStreamStall(Readable.fromWeb(res.body as any), config.timeout)
        : Readable.from([])) as any,
    };
  }

  try {
    const data = await parseResponseData(res);
    if (!res.ok) {
      throw new HttpError({
        status: res.status,
        headers: responseHeaders,
        data,
      });
    }
    return { status: res.status, headers: responseHeaders, data };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function parseResponseData(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toLowerCaseKeys(
  headers?: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

function buildFullUrl(url: string, config: HttpRequestConfig): string {
  let fullUrl = url;
  if (config.baseURL && !/^https?:\/\//i.test(url)) {
    // Concatenate rather than `new URL(url, base)` so a base with a path
    // prefix (e.g. on-prem Nx Cloud) is preserved
    fullUrl =
      config.baseURL.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
  }
  if (config.params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== null && value !== undefined) {
        search.append(key, String(value));
      }
    }
    const queryString = search.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }
  return fullUrl;
}

/**
 * Destroys the stream if no data arrives for `timeout` ms. Resets per chunk,
 * so slow-but-progressing downloads survive while stalls still abort.
 */
function guardStreamStall(source: Readable, timeout?: number): Readable {
  if (!timeout) return source;
  const out = new PassThrough();
  let timer: NodeJS.Timeout;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const error = new DOMException(
        `Response stalled for ${timeout}ms`,
        'TimeoutError'
      );
      source.destroy(error as any);
      out.destroy(error as any);
    }, timeout);
  };
  arm();
  source.on('data', arm);
  source.on('end', () => clearTimeout(timer));
  source.on('close', () => clearTimeout(timer));
  source.on('error', (e) => {
    clearTimeout(timer);
    out.destroy(e);
  });
  source.pipe(out);
  return out;
}

let envProxyAgent: any;

function resolveFetch(): { fetchImpl: typeof fetch; dispatcher?: any } {
  // Native fetch ignores HTTP(S)_PROXY env vars, which axios honored; route
  // through undici's EnvHttpProxyAgent (also handles NO_PROXY) when they are set
  if (
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy
  ) {
    const undici = require('undici');
    envProxyAgent ??= new undici.EnvHttpProxyAgent();
    return { fetchImpl: undici.fetch, dispatcher: envProxyAgent };
  }
  return { fetchImpl: fetch };
}
