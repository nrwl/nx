import {
  mapAsyncIterator,
  combineAsyncIterators,
  tapAsyncIterator,
} from './async-iterator';

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

    const c = combineAsyncIterators(a(), b());
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

    const c = combineAsyncIterators(a(), b());

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

describe('mapAsyncIterator', () => {
  it('should map over values', async () => {
    async function* f() {
      yield 1;
      yield 2;
      yield 3;
    }

    const c = mapAsyncIterator(f(), (x) => x * 2);
    const results = [];

    for await (const x of c) {
      results.push(x);
    }

    expect(results).toEqual([2, 4, 6]);
  });
});

describe('tapAsyncIterator', () => {
  it('should tap values', async () => {
    async function* f() {
      yield 1;
      yield 2;
      yield 3;
    }

    const tapped = [];
    const results = [];

    const c = tapAsyncIterator(f(), (x) => {
      tapped.push(`tap: ${x}`);
    });

    for await (const x of c) {
      results.push(x);
    }

    expect(tapped).toEqual(['tap: 1', 'tap: 2', 'tap: 3']);
    expect(results).toEqual([1, 2, 3]);
  });
});
