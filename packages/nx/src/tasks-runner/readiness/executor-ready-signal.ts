import { emitReadySignal } from './ready-signal';

/**
 * Passes the executor's results through unchanged and signals the task ready
 * at the `baseUrl` of the first successful result that has one.
 */
export async function* signalReadyAtBaseUrl<T extends { success: boolean }>(
  results: AsyncIterableIterator<T>
): AsyncIterableIterator<T> {
  const iterator = results[Symbol.asyncIterator]();
  let signalled = false;
  while (true) {
    const result = await iterator.next();
    if (result.done) {
      return result.value;
    }
    if (!signalled) {
      const url = getReadySignalUrl(result.value);
      if (url) {
        signalled = true;
        emitReadySignal(url);
      }
    }
    yield result.value;
  }
}

function getReadySignalUrl(result: {
  success: boolean;
  baseUrl?: unknown;
}): string | undefined {
  const { baseUrl } = result;
  if (
    result.success !== true ||
    typeof baseUrl !== 'string' ||
    !URL.canParse(baseUrl)
  ) {
    return undefined;
  }
  const url = new URL(baseUrl);
  // `localhost:4200` parses too, with `localhost:` as its protocol
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return undefined;
  }
  if (url.hostname === '0.0.0.0' || url.hostname === '[::]') {
    url.hostname = 'localhost';
  }
  return url.href;
}
