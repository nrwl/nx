export async function* mapAsyncIterable<T = any, I = any, O = any>(
  data: AsyncIterable<T> | AsyncIterableIterator<T>,
  transform: (
    input: I,
    index?: number,
    data?: AsyncIterable<T> | AsyncIterableIterator<T>
  ) => O
): AsyncIterable<O> | AsyncIterableIterator<O> {
  async function* f() {
    const source: Partial<AsyncIterable<T>> & Partial<Iterable<T>> = data;
    const iterator =
      source[Symbol.asyncIterator]?.() ?? source[Symbol.iterator]?.();
    if (!iterator) {
      throw new TypeError('The data is not iterable.');
    }
    let index = 0;
    let item = await iterator.next();
    while (!item.done) {
      yield await transform((await item.value) as I, index, data);
      index++;
      item = await iterator.next();
    }
  }

  return yield* f();
}
