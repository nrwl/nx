import { checkWithPrettier } from './prettier';

// Mirrors `check-with-oxfmt.spec.ts`. `nx format:check` gates CI on this
// function's verdict, and the branches that matter most are the ones e2e cannot
// reach: a formatter that was killed, could not be spawned, or overran its
// stdout buffer. Those report a *string* `code` (or none at all) rather than an
// exit code, and must never be read as success.
jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  exec: jest.fn(),
}));

const { exec } = require('node:child_process');

describe('checkWithPrettier', () => {
  function respondWith(error: unknown, stdout = '') {
    (exec as jest.Mock).mockImplementation(
      (_cmd: string, _opts: unknown, callback: Function) => {
        callback(error, stdout);
        return {};
      }
    );
  }

  afterEach(() => {
    (exec as jest.Mock).mockReset();
  });

  it('reports nothing to fix when prettier exits 0', async () => {
    respondWith(null);

    await expect(checkWithPrettier(['.'])).resolves.toEqual([]);
  });

  it('reports the differing files when prettier exits 1 with output', async () => {
    respondWith({ code: 1 }, 'libs/a.ts\nlibs/b.ts\n');

    await expect(checkWithPrettier(['.'])).resolves.toEqual([
      'libs/a.ts',
      'libs/b.ts',
    ]);
  });

  it('rejects when prettier exits 2 even though it listed files first', async () => {
    // Measured: a batch of one differing file plus one unparseable file exits
    // 2 with the differing file already on stdout. Reading that as the file
    // list reports the diff and loses the syntax error - the file nobody can
    // format never gets mentioned.
    respondWith(
      Object.assign(new Error('SyntaxError: Unexpected token'), { code: 2 }),
      'libs/a.ts\n'
    );

    await expect(checkWithPrettier(['.'])).rejects.toThrow(
      'SyntaxError: Unexpected token'
    );
  });

  it('rejects when prettier exits non-zero without output', async () => {
    // No file list means prettier failed rather than found differences - an
    // unreadable config, a file it cannot parse. `exec` hands back a real
    // Error, and this branch rejects with it untouched.
    respondWith(
      Object.assign(new Error('No parser could be inferred'), { code: 2 }),
      ''
    );

    await expect(checkWithPrettier(['.'])).rejects.toThrow(
      'No parser could be inferred'
    );
  });

  it.each([
    [
      'the binary cannot be spawned',
      { code: 'ENOENT', message: 'spawn node ENOENT' },
    ],
    [
      'stdout overruns maxBuffer',
      {
        code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
        message: 'stdout maxBuffer length exceeded',
      },
    ],
    [
      'the process is killed',
      { code: null, signal: 'SIGKILL', message: 'Command failed' },
    ],
  ])('rejects rather than reporting a clean tree when %s', async (_, error) => {
    // Reported as "everything is formatted", this is a CI gate passing on an
    // unformatted tree that nobody can reproduce locally. Note the non-empty
    // stdout: without the exit-code guard this resolves as a file list.
    respondWith(error, 'libs/a.ts\n');

    await expect(checkWithPrettier(['.'])).rejects.toThrow(
      /could not be run to completion/
    );
  });
});
