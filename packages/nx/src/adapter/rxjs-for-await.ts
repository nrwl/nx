import { Observable } from 'rxjs';

export class Deferred<T> {
  resolve: (value: T | PromiseLike<T>) => void = null!;
  reject: (reason?: any) => void = null!;
  promise = new Promise<T>((a, b) => {
    this.resolve = a;
    this.reject = b;
  });
}

const RESOLVED = Promise.resolve();

/**
 * Will subscribe to the `source` observable provided,
 *
 * Allowing a `for await..of` loop to iterate over every
 * value that the source emits.
 *
 * **WARNING**: If the async loop is slower than the observable
 * producing values, the values will build up in a buffer
 * and you could experience an out of memory error.
 *
 * This is a lossless subscription method. No value
 * will be missed or duplicated.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const value of eachValueFrom(source$)) {
 *     console.log(value);
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export async function* eachValueFrom<T>(
  source: Observable<T>
): AsyncIterableIterator<T> {
  const deferreds: Deferred<IteratorResult<T>>[] = [];
  const values: T[] = [];
  let hasError = false;
  let error: any = null;
  let completed = false;

  const subs = source.subscribe({
    next: (value) => {
      if (deferreds.length > 0) {
        deferreds.shift()!.resolve({ value, done: false });
      } else {
        values.push(value);
      }
    },
    error: (err) => {
      hasError = true;
      error = err;
      while (deferreds.length > 0) {
        deferreds.shift()!.reject(err);
      }
    },
    complete: () => {
      completed = true;
      while (deferreds.length > 0) {
        deferreds.shift()!.resolve({ value: undefined, done: true });
      }
    },
  });

  try {
    while (true) {
      if (values.length > 0) {
        yield values.shift()!;
      } else if (completed) {
        return;
      } else if (hasError) {
        throw error;
      } else {
        const d = new Deferred<IteratorResult<T>>();
        deferreds.push(d);
        const result = await d.promise;
        if (result.done) {
          return;
        } else {
          yield result.value;
        }
      }
    }
  } catch (err) {
    throw err;
  } finally {
    subs.unsubscribe();
  }
}

/**
 * Will subscribe to the `source` observable provided
 * and build the emitted values up in a buffer. Allowing
 * `for await..of` loops to iterate and get the buffer
 * on each loop.
 *
 * This is a lossless subscription method. No value
 * will be missed or duplicated.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const buffer of bufferedValuesFrom(source$)) {
 *     for (const value of buffer) {
 *       console.log(value);
 *     }
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export async function* bufferedValuesFrom<T>(source: Observable<T>) {
  let deferred: Deferred<IteratorResult<T[]>> | null = null;
  const buffer: T[] = [];
  let hasError = false;
  let error: any = null;
  let completed = false;

  const subs = source.subscribe({
    next: (value) => {
      if (deferred) {
        deferred.resolve(
          RESOLVED.then(() => {
            const bufferCopy = buffer.slice();
            buffer.length = 0;
            return { value: bufferCopy, done: false };
          })
        );
        deferred = null;
      }
      buffer.push(value);
    },
    error: (err) => {
      hasError = true;
      error = err;
      if (deferred) {
        deferred.reject(err);
        deferred = null;
      }
    },
    complete: () => {
      completed = true;
      if (deferred) {
        deferred.resolve({ value: undefined, done: true });
        deferred = null;
      }
    },
  });

  try {
    while (true) {
      if (buffer.length > 0) {
        const bufferCopy = buffer.slice();
        buffer.length = 0;
        yield bufferCopy;
      } else if (completed) {
        return;
      } else if (hasError) {
        throw error;
      } else {
        deferred = new Deferred<IteratorResult<T[]>>();
        const result = await deferred.promise;
        if (result.done) {
          return;
        } else {
          yield result.value;
        }
      }
    }
  } catch (err) {
    throw err;
  } finally {
    subs.unsubscribe();
  }
}

/**
 * Will subscribe to the provided `source` observable,
 * allowing `for await..of` loops to iterate and get the
 * most recent value that was emitted. Will not iterate out
 * the same emission twice.
 *
 * This is a lossy subscription method. Do not use if
 * every value is important.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const value of latestValueFrom(source$)) {
 *     console.log(value);
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export async function* latestValueFrom<T>(source: Observable<T>) {
  let deferred: Deferred<IteratorResult<T>> | undefined = undefined;
  let latestValue: T;
  let hasLatestValue = false;
  let hasError = false;
  let error: any = null;
  let completed = false;

  const subs = source.subscribe({
    next: (value) => {
      hasLatestValue = true;
      latestValue = value;
      if (deferred) {
        deferred.resolve(
          RESOLVED.then(() => {
            hasLatestValue = false;
            return { value: latestValue, done: false };
          })
        );
      }
    },
    error: (err) => {
      hasError = true;
      error = err;
      if (deferred) {
        deferred.reject(err);
      }
    },
    complete: () => {
      completed = true;
      if (deferred) {
        hasLatestValue = false;
        deferred.resolve({ value: undefined, done: true });
      }
    },
  });

  try {
    while (true) {
      if (hasLatestValue) {
        await RESOLVED;
        const value = latestValue!;
        hasLatestValue = false;
        yield value;
      } else if (completed) {
        return;
      } else if (hasError) {
        throw error;
      } else {
        deferred = new Deferred<IteratorResult<T>>();
        const result = await deferred.promise;
        if (result.done) {
          return;
        } else {
          yield result.value;
        }
      }
    }
  } catch (err) {
    throw err;
  } finally {
    subs.unsubscribe();
  }
}

/**
 * Subscribes to the provided `source` observable and allows
 * `for await..of` loops to iterate over it, such that
 * all values are dropped until the iteration occurs, then
 * the very next value that arrives is provided to the
 * `for await` loop.
 *
 * This is a lossy subscription method. Do not use if
 * every value is important.
 *
 * Example usage:
 *
 * ```ts
 * async function test() {
 *   const source$ = getSomeObservable();
 *
 *   for await(const value of nextValueFrom(source$)) {
 *     console.log(value);
 *   }
 * }
 * ```
 *
 * @param source the Observable source to await values from
 */
export async function* nextValueFrom<T>(
  source: Observable<T>
): AsyncGenerator<T, void, void> {
  let deferred: Deferred<IteratorResult<T>> | undefined = undefined;
  let hasError = false;
  let error: any = null;
  let completed = false;

  const subs = source.subscribe({
    next: (value) => {
      if (deferred) {
        deferred.resolve({ value, done: false });
      }
    },
    error: (err) => {
      hasError = true;
      error = err;
      if (deferred) {
        deferred.reject(err);
      }
    },
    complete: () => {
      completed = true;
      if (deferred) {
        deferred.resolve({ value: undefined, done: true });
      }
    },
  });

  try {
    while (true) {
      if (completed) {
        return;
      } else if (hasError) {
        throw error;
      } else {
        deferred = new Deferred<IteratorResult<T>>();
        const result = await deferred.promise;
        if (result.done) {
          return;
        } else {
          yield result.value;
        }
      }
    }
  } catch (err) {
    throw err;
  } finally {
    subs.unsubscribe();
  }
}
