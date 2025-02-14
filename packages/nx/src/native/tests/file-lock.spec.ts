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

    a.stdout.on('data', (data) => {
      combinedOutputs.push('A: ' + data.toString().trim());
    });
    b.stdout.on('data', (data) => {
      combinedOutputs.push('B: ' + data.toString().trim());
    });

    a.stderr.pipe(process.stderr);
    b.stderr.pipe(process.stderr);

    await Promise.all([a, b].map((p) => new Promise((r) => p.once('exit', r))));

    expect(combinedOutputs).toContain('A: ran with lock');
    expect(combinedOutputs).toContain('B: waited for lock');
  });
});
