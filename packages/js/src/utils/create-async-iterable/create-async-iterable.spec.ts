import { createAsyncIterable } from './create-async-iteratable';

describe(createAsyncIterable.name, () => {
  test('simple callback', async () => {
    const it = createAsyncIterable<string>(({ next, done }) => {
      setTimeout(() => next('bye'), 10);
      setTimeout(() => next('hello'), 0);
      setTimeout(() => done(), 20);
      setTimeout(() => next('ignored'), 30);
    });
    const results: string[] = [];
    for await (const x of it) {
      results.push(x);
    }

    expect(results).toEqual(['hello', 'bye']);
  });

  test('throwing error', async () => {
    const it = createAsyncIterable(({ next, error }) => {
      setTimeout(() => next('hello'), 0);
      setTimeout(() => error(new Error('Oops')), 10);
    });

    await expect(async () => {
      for await (const _x of it) {
        // nothing
      }
    }).rejects.toThrow(/Oops/);
  });

  test('multiple signals in the same macro/microtask', async () => {
    const it = createAsyncIterable<string>(({ next, done }) => {
      setTimeout(() => {
        next('first');
      });

      setTimeout(() => {
        // should pass through in the same macro/microtask
        next('second');
        next('third');
        next('fourth');
        done();
      }, 10);

      setTimeout(() => {
        next('should be ignored');
      }, 20);
    });

    const results: string[] = [];
    for await (const x of it) {
      results.push(x);
    }

    expect(results).toEqual(['first', 'second', 'third', 'fourth']);
  });
});
