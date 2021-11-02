import * as childProcess from 'child_process';
import { spawnProcess } from './spawn-process';

describe('spawnProcess()', () => {
  let spy: jest.SpyInstance<
    childProcess.SpawnSyncReturns<Buffer>,
    [
      command: string,
      args?: readonly string[],
      options?: childProcess.SpawnSyncOptions
    ]
  >;

  beforeEach(() => {
    spy = jest.spyOn(childProcess, 'spawnSync');
  });

  afterEach(() => {
    spy.mockReset();
    spy.mockRestore();
  });

  it('should call spawnSync and return the stdout', () => {
    const mockedStdout = 'stdout';
    spy.mockImplementation(() => {
      return {
        status: 0,
        stdout: mockedStdout,
      } as any;
    });
    const output = spawnProcess('git', ['status', '-s', '-u', '-z', '.'], '');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(output).toEqual(mockedStdout);
  });

  it('should work even when ANSI escape characters are present in the child process output - https://github.com/nrwl/nx/issues/7022', () => {
    spy.mockImplementation(() => {
      return {
        status: 0,
        // ANSI escaped characters can come through in the child process output, as reported here: https://github.com/nrwl/nx/issues/7022
        stdout:
          ' \x1B[7;33mM\x1B[m packages/semver/src/generators/install/index.spec.ts\x00',
      } as any;
    });

    const output = spawnProcess('git', ['status', '-s', '-u', '-z', '.'], '');
    expect(spy).toHaveBeenCalledTimes(1);

    /**
     * Ensure the ANSI escaped characters have been stripped
     * (the remaining trailing \0 is expected as part of the real-world git output)
     */
    expect(output).toEqual(
      ' M packages/semver/src/generators/install/index.spec.ts\0'
    );
  });
});
