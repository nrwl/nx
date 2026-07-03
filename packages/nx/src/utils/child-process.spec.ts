import { runNxArgvSync } from './child-process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawnSync: jest.fn(),
}));

import { spawnSync } from 'child_process';

describe('runNxArgvSync', () => {
  const spawnSyncMock = spawnSync as jest.Mock;

  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ status: 0 });
  });

  it('passes every argument through verbatim with no shell involved', () => {
    const argv = [
      '_migrate',
      '--commit-prefix=chore(repo): [nx migration] ',
      '--data=%FOO% and ^caret and $HOME',
      '',
    ];

    runNxArgvSync(argv, { nxBin: '/tmp/nx/bin/nx.js' });

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnSyncMock.mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(args).toEqual(['/tmp/nx/bin/nx.js', ...argv]);
    expect(options.shell).toBeUndefined();
  });

  it('throws an error carrying the exit status when the command fails', () => {
    spawnSyncMock.mockReturnValue({ status: 7 });

    let caught: any;
    try {
      runNxArgvSync(['_migrate'], { nxBin: '/tmp/nx/bin/nx.js' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.status).toBe(7);
  });

  it('throws the spawn error when the process could not start', () => {
    spawnSyncMock.mockReturnValue({ error: new Error('ENOENT'), status: null });

    expect(() =>
      runNxArgvSync(['_migrate'], { nxBin: '/tmp/nx/bin/nx.js' })
    ).toThrow('ENOENT');
  });
});
