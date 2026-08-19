import { PassThrough, Readable } from 'stream';
import type { Agent as HttpAgent } from 'http';
import type { Agent as HttpsAgent } from 'https';
import { logger } from './logger';

export interface HttpRequestConfig {
  method?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | null | undefined>;
  data?: unknown;
  timeout?: number;
  responseType?: 'json' | 'stream';
  signal?: AbortSignal;
  /**
   * Axios-compatible fields, honored for nxCloudProxyConfig
   * (customProxyConfigPath) users. Requests with agents go through
   * node:http(s), which consumes them the same way axios did.
   */
  httpAgent?: HttpAgent;
  httpsAgent?: HttpsAgent;
  proxy?:
    | false
    | {
        host: string;
        port: number;
        protocol?: string;
        auth?: { username: string; password: string };
      };
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
    headers: { ...defaults.headers, ...config.headers },
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

  const headers: Record<string, string> = { ...config.headers };
  let body: string | undefined;
  if (config.data !== undefined) {
    body = JSON.stringify(config.data);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
      headers['content-type'] = 'application/json';
    }
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

  if (config.httpAgent || config.httpsAgent) {
    // The agent owns the connection, so an explicit proxy cannot also apply
    if (config.proxy) {
      logger.warn(
        'Both an http(s) agent and a proxy were configured; the agent is used and the proxy option is ignored.'
      );
    }
    return nodeTransportRequest(
      fullUrl,
      config,
      headers,
      body,
      controller,
      timer
    );
  }

  const { fetchImpl, dispatcher } = resolveFetch(config);

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
      data: guardStreamStall(
        Readable.fromWeb(res.body as any),
        config.timeout
      ) as any,
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

let envProxyAgent: any;

function resolveFetch(config: HttpRequestConfig): {
  fetchImpl: typeof fetch;
  dispatcher?: any;
} {
  if (config.proxy) {
    const undici = require('undici');
    const { host, port, protocol, auth } = config.proxy;
    return {
      fetchImpl: undici.fetch,
      dispatcher: new undici.ProxyAgent({
        uri: `${(protocol ?? 'http').replace(/:$/, '')}://${host}:${port}`,
        ...(auth
          ? {
              token: `Basic ${Buffer.from(
                `${auth.username}:${auth.password}`
              ).toString('base64')}`,
            }
          : {}),
      }),
    };
  }
  // axios semantics: `proxy: false` opts out of env-based proxying
  if (config.proxy === false) {
    return { fetchImpl: fetch };
  }
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

// Same limit axios (follow-redirects) used
const MAX_REDIRECTS = 21;

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

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

/**
 * node:http(s) transport for requests carrying axios-style agent options
 * (nxCloudProxyConfig). fetch cannot consume http.Agent instances.
 */
function nodeTransportRequest<T>(
  fullUrl: string,
  config: HttpRequestConfig,
  headers: Record<string, string>,
  body: string | undefined,
  controller: AbortController,
  timer: NodeJS.Timeout | null,
  redirectCount = 0
): Promise<HttpResponse<T>> {
  const isHttps = fullUrl.startsWith('https:');
  const { request } = isHttps ? require('https') : require('http');
  const agent = isHttps ? config.httpsAgent : config.httpAgent;

  return new Promise<HttpResponse<T>>((resolve, reject) => {
    const req = request(
      fullUrl,
      {
        method: config.method ?? 'GET',
        headers,
        agent,
        signal: controller.signal,
      },
      (res: import('http').IncomingMessage) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error('Maximum number of redirects exceeded'));
            return;
          }
          const location = new URL(res.headers.location, fullUrl).href;
          // 301/302/303 demote to GET, matching fetch/follow-redirects
          const nextConfig =
            res.statusCode === 307 || res.statusCode === 308
              ? config
              : { ...config, method: 'GET' };
          const nextBody =
            res.statusCode === 307 || res.statusCode === 308 ? body : undefined;
          // Don't leak credentials across origins (matches fetch/axios)
          let nextHeaders = headers;
          if (new URL(location).origin !== new URL(fullUrl).origin) {
            nextHeaders = { ...headers };
            for (const header of Object.keys(nextHeaders)) {
              if (SENSITIVE_HEADERS.includes(header.toLowerCase())) {
                delete nextHeaders[header];
              }
            }
          }
          resolve(
            nodeTransportRequest(
              location,
              nextConfig,
              nextHeaders,
              nextBody,
              controller,
              timer,
              redirectCount + 1
            )
          );
          return;
        }

        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          responseHeaders[key] = Array.isArray(value)
            ? value.join(', ')
            : (value ?? '');
        }

        if (
          config.responseType === 'stream' &&
          res.statusCode >= 200 &&
          res.statusCode < 300
        ) {
          if (timer) clearTimeout(timer);
          resolve({
            status: res.statusCode,
            headers: responseHeaders,
            data: guardStreamStall(res, config.timeout) as any,
          });
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          if (timer) clearTimeout(timer);
          const text = Buffer.concat(chunks).toString('utf-8');
          let data: any;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          // 2xx only, like axios's default validateStatus (an unfollowed
          // 3xx is an error)
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(
              new HttpError({
                status: res.statusCode,
                headers: responseHeaders,
                data,
              })
            );
          } else {
            resolve({
              status: res.statusCode,
              headers: responseHeaders,
              data,
            });
          }
        });
      }
    );
    req.on('error', (e: Error) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}
