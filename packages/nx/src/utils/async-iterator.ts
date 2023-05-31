export function isAsyncIterator<T>(v: any): v is AsyncIterableIterator<T> {
  return typeof v?.[Symbol.asyncIterator] === 'function';
}

export async function getLastValueFromAsyncIterableIterator<T>(
  i: AsyncIterableIterator<T>
): Promise<T> {
  let prev: IteratorResult<T, T>;
  let current: IteratorResult<T, T>;
  do {
    prev = current;
    current = await i.next();
  } while (!current.done);

  return current.value !== undefined || !prev ? current.value : prev.value;
}
