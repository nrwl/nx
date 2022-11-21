import { mapAsyncIterable } from './map-async-iteratable';

export async function* tapAsyncIterator<T = any, I = any, O = any>(
  data: AsyncIterable<T> | AsyncIterableIterator<T>,
  fn: (input: I) => void
) {
  return yield* mapAsyncIterable(data, (x) => {
    fn(x);
    return x;
  });
}
