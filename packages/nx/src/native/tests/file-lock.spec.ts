import { fork } from 'child_process';
import { join } from 'path';

describe('file-lock', () => {
  it('should block the second call until the first one is done', async () => {
    let combinedOutputs = [];
    let a = fork(join(__dirname, './__fixtures__/file-lock.fixture.js'), {
      env: {
        LABEL: 'a',
        NX_NATIVE_LOGGING: 'trace',
      },
      stdio: 'pipe',
      execArgv: ['--require', 'ts-node/register'],
    });

    // Gives a bit of time to make the outputs of the tests more predictable...
    // if both start at the same time, its hard to guarantee that a will get the lock before b.
    await new Promise((r) => setTimeout(r, 500));

    let b = fork(join(__dirname, './__fixtures__/file-lock.fixture.js'), {
      env: {
        LABEL: 'b',
        NX_NATIVE_LOGGING: 'trace',
      },
      stdio: 'pipe',
      execArgv: ['--require', 'ts-node/register'],
    });

    // Native trace logging shares stdout, and chunks can coalesce under load.
    const collect = (label: string) => (data: Buffer) => {
      for (const line of data.toString().split('\n')) {
        if (line.trim()) {
          combinedOutputs.push(`${label}: ${line.trim()}`);
        }
      }
    };
    a.stdout.on('data', collect('A'));
    b.stdout.on('data', collect('B'));

    a.stderr.pipe(process.stderr);
    b.stderr.pipe(process.stderr);

    await Promise.all([a, b].map((p) => new Promise((r) => p.once('exit', r))));

    // Startup time decides which process takes the lock first, so assert
    // that one holder ran and the other waited rather than which was which.
    const ran = combinedOutputs.filter((o) => o.endsWith(': ran with lock'));
    const waited = combinedOutputs.filter((o) =>
      o.endsWith(': waited for lock')
    );
    expect(ran).toHaveLength(1);
    expect(waited).toHaveLength(1);
    expect(ran[0][0]).not.toBe(waited[0][0]);
  });
});
