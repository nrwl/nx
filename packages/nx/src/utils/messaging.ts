export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  return (data) => {
    const chunk = data.toString();
    if (chunk.codePointAt(chunk.length - 1) === 4) {
      message += chunk.substring(0, chunk.length - 1);

      // Server may send multiple messages in one chunk, so splitting by 0x4
      const messages = message.split('');
      for (const splitMessage of messages) {
        callback(splitMessage);
      }

      message = '';
    } else {
      message += chunk;
    }
  };
}

export interface PendingPromise {
  promise: Promise<unknown>;
  resolver: (result: any) => void;
  rejector: (err: any) => void;
}

export function registerPendingPromise(
  tx: string,
  pending: Map<string, PendingPromise>,
  callback: () => void,
  timeoutErrorText: () => string,
  timeoutMs: number
): Promise<any> {
  let resolver: (x: unknown) => void,
    rejector: (e: Error | unknown) => void,
    timeout: NodeJS.Timeout;

  const promise = new Promise((res, rej) => {
    rejector = rej;
    resolver = res;

    timeout = setTimeout(() => {
      rej(new Error(timeoutErrorText()));
    }, timeoutMs);

    callback();
  }).finally(() => {
    pending.delete(tx);
    if (timeout) clearTimeout(timeout);
  });

  pending.set(tx, {
    promise,
    resolver,
    rejector,
  });

  return promise;
}
