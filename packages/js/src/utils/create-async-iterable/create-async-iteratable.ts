export interface AsyncPushCallbacks<T> {
  next: (value: T) => void;
  done: () => void;
  error: (err: unknown) => void;
}

export function createAsyncIterable<T = unknown>(
  listener: (ls: AsyncPushCallbacks<T>) => void
): AsyncIterable<T> {
  let done = false;
  let error: unknown | null = null;

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
          } else {
            error = err;
          }
        },
        done: () => {
          if (pullQueue.length > 0) {
            pullQueue.shift()?.[0]({ value: undefined, done: true });
          } else {
            done = true;
          }
        },
      });

      return {
        next() {
          return new Promise<{ value: T | undefined; done: boolean }>(
            (resolve, reject) => {
              if (done) resolve({ value: undefined, done: true });
              if (error) reject(error);

              if (pushQueue.length > 0) {
                resolve({ value: pushQueue.shift(), done: false });
              } else {
                pullQueue.push([resolve, reject]);
              }
            }
          );
        },
      };
    },
  } as AsyncIterable<T>;
}
