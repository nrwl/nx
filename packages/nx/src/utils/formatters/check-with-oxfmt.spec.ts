import { checkWithOxfmt } from './oxfmt';

// `nx format:check` gates CI on this function's verdict, and the branches that
// matter most are the ones e2e cannot reach: a formatter that was killed, could
// not be spawned, or overran its stdout buffer. Those report a *string* `code`
// (or none at all) rather than an exit code, and must never be read as success.
jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  execFile: jest.fn(),
}));

const { execFile } = require('node:child_process');

describe('checkWithOxfmt', () => {
  function respondWith(error: unknown, stdout = '', stderr = '') {
    (execFile as jest.Mock).mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
        callback(error, stdout, stderr);
        return {};
      }
    );
  }

  afterEach(() => {
    (execFile as jest.Mock).mockReset();
  });

  it('reports nothing to fix when oxfmt exits 0', async () => {
    respondWith(null);

    await expect(checkWithOxfmt(['.'])).resolves.toEqual([]);
  });

  it('reports the differing files when oxfmt exits 1 with output', async () => {
    respondWith({ code: 1 }, 'libs/a.ts\nlibs/b.ts\n');

    await expect(checkWithOxfmt(['.'])).resolves.toEqual([
      'libs/a.ts',
      'libs/b.ts',
    ]);
  });

  it('rejects when oxfmt exits 1 without output, which means a bad config', async () => {
    respondWith({ code: 1 }, '', 'Failed to load configuration file.');

    await expect(checkWithOxfmt(['.'])).rejects.toThrow(
      'Failed to load configuration file.'
    );
  });

  it('rejects when oxfmt exits 2', async () => {
    respondWith({ code: 2 }, '', 'oxfmt failed');

    await expect(checkWithOxfmt(['.'])).rejects.toThrow('oxfmt failed');
  });

  it('rejects on exit 2 even though oxfmt already printed differing files', async () => {
    // oxfmt writes the differing paths to stdout *before* it reports an error,
    // so a non-empty stdout does not mean the run succeeded. Reading this as a
    // file list would report a formatter that failed outright as "these files
    // differ" - a `format:check` that is wrong rather than red.
    respondWith({ code: 2 }, 'libs/a.ts\n', 'oxfmt failed');

    await expect(checkWithOxfmt(['.'])).rejects.toThrow('oxfmt failed');
  });

  it('passes the base args that keep an all-skipped run green', async () => {
    // Without `--no-error-on-unmatched-pattern` oxfmt exits 2 when every path
    // in a batch was skipped, and nx routinely hands it mixed file lists.
    respondWith(null);

    await checkWithOxfmt(['.']);

    expect(execFile).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining([
        '--no-error-on-unmatched-pattern',
        '--list-different',
      ]),
      expect.anything(),
      expect.any(Function)
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
    // unformatted tree that nobody can reproduce locally.
    respondWith(error, 'libs/a.ts\n');

    await expect(checkWithOxfmt(['.'])).rejects.toThrow(
      /could not be run to completion/
    );
  });
});
