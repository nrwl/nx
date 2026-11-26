export function isAsyncIterator<T>(v: any): v is AsyncIterableIterator<T> {
  return typeof v?.[Symbol.asyncIterator] === 'function';
}

export async function getLastValueFromAsyncIterableIterator<T>(
  i: AsyncIterable<T> | AsyncIterableIterator<T> | Iterable<T>
): Promise<T> {
  let prev: IteratorResult<T, T> | undefined;
  let current: IteratorResult<T, T> | undefined;

  const iterator =
    Symbol.asyncIterator in i
      ? i[Symbol.asyncIterator]()
      : i[Symbol.iterator]();

  do {
    prev = current;
    current = await iterator.next();
  } while (!current.done);

  return current.value !== undefined || !prev ? current.value : prev.value;
}
