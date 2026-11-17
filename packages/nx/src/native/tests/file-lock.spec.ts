import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

describe('file-lock', () => {
  it('should block the second call until the first one is done', async () => {
    let combinedOutputs = [];

    // Native trace logging shares stdout, and chunks can coalesce under load.
    const collect = (label: string) => (data: Buffer) => {
      for (const line of data.toString().split('\n')) {
        if (line.trim()) {
          combinedOutputs.push(`${label}: ${line.trim()}`);
        }
      }
    };
    const printed = (child: ChildProcess, label: string, lines: string[]) =>
      new Promise<void>((resolve, reject) => {
        child.stdout.on('data', () => {
          if (
            lines.some((line) => combinedOutputs.includes(`${label}: ${line}`))
          ) {
            resolve();
          }
        });
        child.once('exit', () =>
          reject(new Error(`${label} exited before printing ${lines}`))
        );
      });

    let a = fork(join(__dirname, './__fixtures__/file-lock.fixture.js'), {
      env: {
        LABEL: 'a',
        NX_NATIVE_LOGGING: 'trace',
        HOLD_UNTIL_RELEASED: 'true',
      },
      stdio: 'pipe',
      execArgv: ['--require', 'ts-node/register'],
    });
    a.stdout.on('data', collect('A'));
    a.stderr.pipe(process.stderr);

    // b checks the lock only while a holds it, and a holds it until b has checked
    await printed(a, 'A', ['holding lock']);

    let b = fork(join(__dirname, './__fixtures__/file-lock.fixture.js'), {
      env: {
        LABEL: 'b',
        NX_NATIVE_LOGGING: 'trace',
      },
      stdio: 'pipe',
      execArgv: ['--require', 'ts-node/register'],
    });
    b.stdout.on('data', collect('B'));
    b.stderr.pipe(process.stderr);

    await printed(b, 'B', ['found lock held', 'found lock free']);
    const exited = [a, b].map((p) => new Promise((r) => p.once('exit', r)));
    a.send('release');
    await Promise.all(exited);

    const ran = combinedOutputs.filter((o) => o.endsWith(': ran with lock'));
    const waited = combinedOutputs.filter((o) =>
      o.endsWith(': waited for lock')
    );
    expect(ran).toEqual(['A: ran with lock']);
    expect(waited).toEqual(['B: waited for lock']);
  });
});
