export async function* combineAsyncIterators(
  ...iterators: { 0: AsyncIterableIterator<any> } & AsyncIterableIterator<any>[]
) {
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

export async function* mapAsyncIterator<T = any, I = any, O = any>(
  data: AsyncIterableIterator<T>,
  transform: (input: I, index?: number, data?: AsyncIterableIterator<T>) => O
) {
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

export async function* tapAsyncIterator<T = any, I = any, O = any>(
  data: AsyncIterableIterator<T>,
  fn: (input: I) => void
) {
  return yield* mapAsyncIterator(data, (x) => {
    fn(x);
    return x;
  });
}
