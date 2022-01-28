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

  test('forked process', async () => {
    const it = createAsyncIterable<string>(async ({ next, done }) => {
      const cp = await import('child_process');
      const path = await import('path');

      const p = cp.fork(path.join(__dirname, 'fixtures/test.js'));
      p.on('message', (data) => {
        next(data as string);
      });
      p.on('exit', () => {
        done();
      });
      p.send('Alice');
      p.send('Bob');
      p.send('Bye');
    });

    const results: string[] = [];

    for await (const x of it) {
      results.push(x);
    }

    expect(results).toEqual(['Hello Alice', 'Hello Bob', 'Bye']);
  });

  // test('forked process with abort controller', async () => {
  //   const it = createAsyncIterable<string>(async ({ next, error, done }) => {
  //     const cp = await import('child_process');
  //     const path = await import('path');
  //     const controller = new AbortController();
  //     const { signal } = controller;
  //
  //     const p = cp.fork(path.join(__dirname, 'fixtures/test.js'), { signal });
  //     p.on('message', (data) => {
  //       next(data as string);
  //     });
  //     p.on('exit', () => {
  //       done();
  //     });
  //     p.on('error', (err) => {
  //       error(err);
  //     });
  //     p.send('Alice');
  //     setTimeout(() => {
  //       controller.abort();
  //     }, 100);
  //     setTimeout(() => {
  //       p.send('Bob');
  //       p.send('Fred');
  //     }, 110);
  //   });
  //
  //   const results: string[] = [];
  //
  //   await expect(async () => {
  //     for await (const x of it) {
  //       results.push(x);
  //     }
  //   }).rejects.toThrow(/The operation was aborted/);
  //
  //   expect(results).toEqual(['Hello Alice']);
  // });
});
