export async function* combineAsyncIterableIterators<T = any>(
  ...iterators: { 0: AsyncIterableIterator<T> } & AsyncIterableIterator<T>[]
): AsyncGenerator<T> {
  let [options] = iterators;
  if (typeof options.next === 'function') {
    options = Object.create(null);
  } else {
    iterators.shift();
  }

  const getNextAsyncIteratorValue = getNextAsyncIteratorFactory(options);

  try {
    const asyncIteratorsValues = new Map(
      iterators.map((it, idx) => [idx, getNextAsyncIteratorValue(it, idx)])
    );

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
    await Promise.allSettled(iterators.map((it) => it.return()));
  }
}

function getNextAsyncIteratorFactory(options) {
  return async (asyncIterator, index) => {
    try {
      const iterator = await asyncIterator.next();

      return { index, iterator };
    } catch (err) {
      if (options.errorCallback) {
        options.errorCallback(err, index);
      }
      return Promise.reject(err);
    }
  };
}
