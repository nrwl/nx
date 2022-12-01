import { mapAsyncIterable } from './map-async-iteratable';

describe('mapAsyncIterator', () => {
  it('should map over values', async () => {
    async function* f() {
      yield 1;
      yield 2;
      yield 3;
    }

    const c = mapAsyncIterable(f(), (x) => x * 2);
    const results = [];

    for await (const x of c) {
      results.push(x);
    }

    expect(results).toEqual([2, 4, 6]);
  });
});
