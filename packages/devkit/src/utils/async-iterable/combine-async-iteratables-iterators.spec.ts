import { combineAsyncIterableIterators } from './combine-async-iteratable-iterators';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('combineAsyncIterators', () => {
  it('should merge iterators', async () => {
    async function* a() {
      await delay(20);
      yield 'a';
    }

    async function* b() {
      await delay(0);
      yield 'b';
    }

    const c = combineAsyncIterableIterators(a(), b());
    const results = [];

    for await (const x of c) {
      results.push(x);
    }

    expect(results).toEqual(['b', 'a']);
  });

  it('should throw when one iterator throws', async () => {
    async function* a() {
      await delay(20);
      yield 'a';
    }

    async function* b() {
      throw new Error('threw in b');
    }

    const c = combineAsyncIterableIterators(a(), b());

    async function* d() {
      yield* c;
    }

    try {
      for await (const x of d()) {
      }
      throw new Error('should not reach here');
    } catch (e) {
      expect(e.message).toMatch(/threw in b/);
    }
  });
});
