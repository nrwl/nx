import { mapAsyncIterable } from './map-async-iteratable';

export async function* tapAsyncIterable<T = any, I = any, O = any>(
  data: AsyncIterable<T> | AsyncIterableIterator<T>,
  fn: (input: I) => void
): AsyncIterable<T> | AsyncIterableIterator<T> {
  return yield* mapAsyncIterable(data, (x) => {
    fn(x);
    return x;
  });
}
