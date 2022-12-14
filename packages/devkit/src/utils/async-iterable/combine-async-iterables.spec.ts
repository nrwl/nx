import { combineAsyncIterables } from './combine-async-iterables';
import { createAsyncIterable } from './create-async-iterable';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('combineAsyncIterables', () => {
  it('should combine generators', async () => {
    async function* a() {
      await delay(20);
      yield 'a';
    }

    async function* b() {
      await delay(0);
      yield 'b';
    }

    const c = combineAsyncIterables(a(), b());
    const results = [];

    for await (const x of c) {
      results.push(x);
    }

    expect(results).toEqual(['b', 'a']);
  });

  it('should support .throw()', async () => {
    async function* a() {
      yield 1;
      yield 2;
    }

    async function* b() {
      yield 3;
      yield 4;
    }

    const c = combineAsyncIterables(a(), b());
    const results = [];

    try {
      for await (const x of c) {
        results.push(x);
        await c.throw(new Error('oops'));
      }
    } catch (e) {
      expect(e.message).toMatch(/oops/);
      expect(results).toEqual([1]);
    }
  });

  it('should support .return()', async () => {
    async function* a() {
      yield 1;
      yield 2;
    }

    async function* b() {
      yield 3;
      yield 4;
    }

    const c = combineAsyncIterables(a(), b());
    const results = [];

    for await (const x of c) {
      results.push(x);
      const { value: y } = await c.return(10);
      results.push(y);
    }

    expect(results).toEqual([1, 10]);
  });

  it('should throw when one generator throws', async () => {
    async function* a() {
      await delay(20);
      yield 'a';
    }

    async function* b() {
      throw new Error('threw in b');
    }

    const c = combineAsyncIterables(a(), b());

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

  it('should combine async iterables', async () => {
    const a = createAsyncIterable<number>(({ next, done }) => {
      next(1);
      next(2);
      next(3);
      done();
    });
    const b = createAsyncIterable<number>(({ next, done }) => {
      next(4);
      next(5);
      next(6);
      done();
    });

    const c = combineAsyncIterables(a, b);

    const results: number[] = [];
    for await (const x of c) {
      results.push(x);
    }

    expect(results).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it('should throw error when an async iterable throws', async () => {
    const a = createAsyncIterable<number>(({ next, done }) => {
      next(1);
      done();
    });
    const b = createAsyncIterable<number>(({ next, done }) => {
      throw new Error('threw in b');
    });

    const c = combineAsyncIterables(a, b);

    try {
      for await (const _x of c) {
        // nothing
      }
    } catch (e) {
      expect(e.message).toMatch(/threw in b/);
    }
  });
});
