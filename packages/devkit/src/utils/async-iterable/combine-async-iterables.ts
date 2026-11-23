export async function* combineAsyncIterables<T = any>(
  ..._iterators: { 0: AsyncIterable<T> } & AsyncIterable<T>[]
): AsyncGenerator<T> {
  // Convert iterables into iterators with next, return, throws methods.
  // If it's already an iterator, keep it.
  const iterators: AsyncIterableIterator<T>[] = _iterators.map((it) => {
    if ('next' in it && typeof it.next === 'function') {
      return it as AsyncIterableIterator<T>;
    } else {
      return (async function* wrapped() {
        for await (const val of it) {
          yield val;
        }
      })();
    }
  });

  const [first] = iterators;
  let options: object;

  if (typeof first.next === 'function') {
    options = Object.create(null);
  } else {
    iterators.shift();
    options = first;
  }

  const getNextAsyncIteratorValue = getNextAsyncIteratorFactory(options);
  const asyncIteratorsValues = new Map(
    iterators.map((it, idx) => [idx, getNextAsyncIteratorValue(it, idx)])
  );
  try {
    do {
      const { iterator, index } = await Promise.race(
        asyncIteratorsValues.values()
      );
      if (iterator.done) {
        asyncIteratorsValues.delete(index);
      } else {
        yield iterator.value;
        asyncIteratorsValues.set(
          index,
          getNextAsyncIteratorValue(iterators[index], index)
        );
      }
    } while (asyncIteratorsValues.size > 0);
  } finally {
    for (const [, iterator] of asyncIteratorsValues.entries())
      if ('return' in iterator && typeof iterator.return === 'function')
        iterator.return();
  }
}

function getNextAsyncIteratorFactory(options: object) {
  return async <T>(asyncIterator: AsyncIterator<T>, index: number) => {
    try {
      const iterator = await asyncIterator.next();

      return { index, iterator };
    } catch (err) {
      if (
        'errorCallback' in options &&
        typeof options.errorCallback === 'function'
      ) {
        options.errorCallback(err, index);
      }
      return Promise.reject(err);
    }
  };
}
