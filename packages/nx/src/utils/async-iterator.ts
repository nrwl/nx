export function isAsyncIterator<T>(v: any): v is AsyncIterableIterator<T> {
  return typeof v?.[Symbol.asyncIterator] === 'function';
}

export async function getLastValueFromAsyncIterableIterator<T>(
  i: AsyncIterable<T> | AsyncIterableIterator<T>
): Promise<T> {
  let prev: IteratorResult<T, T>;
  let current: IteratorResult<T, T>;

  const generator = i[Symbol.asyncIterator] || i[Symbol.iterator];
  const iterator = generator.call(i);

  do {
    prev = current;
    current = await iterator.next();
  } while (!current.done);

  return current.value !== undefined || !prev ? current.value : prev.value;
}
