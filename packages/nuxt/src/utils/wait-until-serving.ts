import { request as httpRequest, type IncomingMessage } from 'http';
import { request as httpsRequest } from 'https';

/**
 * Resolves once one of `urls` answers with any status but 503, which `nuxt dev`
 * answers until it serves the app. Retries the URLs that refuse or fail.
 */
export async function waitUntilServing(urls: string[]): Promise<void> {
  const controller = new AbortController();
  try {
    await Promise.any(urls.map((url) => poll(url, controller.signal)));
  } finally {
    controller.abort();
  }
}

async function poll(url: string, signal: AbortSignal): Promise<void> {
  for (;;) {
    const status = await getStatus(url, signal);
    signal.throwIfAborted();
    if (status !== undefined && status !== 503) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// No timeout: the CLIs that hold a request until they serve the app answer
// it after the build
function getStatus(
  url: string,
  signal: AbortSignal
): Promise<number | undefined> {
  return new Promise((resolve) => {
    const onResponse = (response: IncomingMessage) => {
      response.resume();
      resolve(response.statusCode);
    };
    const request = url.startsWith('https:')
      ? // Only the status is read, and dev certificates are self-signed
        httpsRequest(
          url,
          { agent: false, rejectUnauthorized: false, signal },
          onResponse
        )
      : httpRequest(url, { agent: false, signal }, onResponse);
    request.on('error', () => resolve(undefined)).end();
  });
}
