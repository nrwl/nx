import { tapAsyncIterable } from './tap-async-iteratable';

describe('tapAsyncIterator', () => {
  it('should tap values', async () => {
    async function* f() {
      yield 1;
      yield 2;
      yield 3;
    }

    const tapped = [];
    const results = [];

    const c = tapAsyncIterable(f(), (x) => {
      tapped.push(`tap: ${x}`);
    });

    for await (const x of c) {
      results.push(x);
    }

    expect(tapped).toEqual(['tap: 1', 'tap: 2', 'tap: 3']);
    expect(results).toEqual([1, 2, 3]);
  });
});
