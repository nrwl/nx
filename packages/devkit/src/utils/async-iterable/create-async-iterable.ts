export interface AsyncPushCallbacks<T> {
  next: (value: T) => void;
  done: () => void;
  error: (err: unknown) => void;
  registerCleanup?: (cb: () => void | Promise<void>) => void;
}

export function createAsyncIterable<T = unknown>(
  listener: (ls: AsyncPushCallbacks<T>) => void
): AsyncIterable<T> {
  let done = false;
  let error: unknown | null = null;
  let cleanup: (() => void | Promise<void>) | undefined;

  const pushQueue: T[] = [];
  const pullQueue: Array<
    [
      (x: { value: T | undefined; done: boolean }) => void,
      (err: unknown) => void
    ]
  > = [];

  return {
    [Symbol.asyncIterator]() {
      listener({
        next: (value) => {
          if (done || error) return;
          if (pullQueue.length > 0) {
            pullQueue.shift()?.[0]({ value, done: false });
          } else {
            pushQueue.push(value);
          }
        },
        error: (err) => {
          if (done || error) return;
          if (pullQueue.length > 0) {
            pullQueue.shift()?.[1](err);
          }
          error = err;
        },
        done: () => {
          if (pullQueue.length > 0) {
            pullQueue.shift()?.[0]({ value: undefined, done: true });
          }
          done = true;
        },
        registerCleanup: (cb) => {
          cleanup = cb;
        },
      });

      return {
        next() {
          return new Promise<{ value: T | undefined; done: boolean }>(
            (resolve, reject) => {
              if (pushQueue.length > 0) {
                resolve({ value: pushQueue.shift(), done: false });
              } else if (done) {
                resolve({ value: undefined, done: true });
              } else if (error) {
                reject(error);
              } else {
                pullQueue.push([resolve, reject]);
              }
            }
          );
        },
        async return() {
          if (cleanup) {
            await cleanup();
          }
          return { value: undefined, done: true };
        },
      };
    },
  } as AsyncIterable<T>;
}
