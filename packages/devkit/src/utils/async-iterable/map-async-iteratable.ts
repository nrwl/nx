export async function* mapAsyncIterable<T = any, I = any, O = any>(
  data: AsyncIterable<T> | AsyncIterableIterator<T>,
  transform: (
    input: I,
    index?: number,
    data?: AsyncIterable<T> | AsyncIterableIterator<T>
  ) => O
): AsyncIterable<O> | AsyncIterableIterator<O> {
  async function* f() {
    const generator = data[Symbol.asyncIterator] || data[Symbol.iterator];
    const iterator = generator.call(data);
    let index = 0;
    let item = await iterator.next();
    while (!item.done) {
      yield await transform(await item.value, index, data);
      index++;
      item = await iterator.next();
    }
  }

  return yield* f();
}
