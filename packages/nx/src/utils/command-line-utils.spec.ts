import { execFileSync, execSync } from 'child_process';
import { splitArgsIntoNxArgsAndOverrides } from './command-line-utils';
import { withEnvironmentVariables as withEnvironment } from '../internal-testing-utils/with-environment';

jest.mock('../project-graph/file-utils');
jest.mock('child_process');

describe('splitArgs', () => {
  const blockedEnvVars = [
    'NX_BASE',
    'NX_HEAD',
    'NX_PARALLEL',
    'NX_SKIP_NX_CACHE',
    'NX_DISABLE_NX_CACHE',
    'NX_SKIP_REMOTE_CACHE',
    'NX_DISABLE_REMOTE_CACHE',
  ];
  let envVarsToRestore: Record<string, string | undefined> = {};

  function blockParentEnvVar(key: string) {
    envVarsToRestore[key] = process.env[key];
    delete process.env[key];
  }

  beforeEach(() => {
    envVarsToRestore = {};
    for (const key of blockedEnvVars) {
      blockParentEnvVar(key);
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(envVarsToRestore)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('should split nx specific arguments into nxArgs', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          base: 'sha1',
          head: 'sha2',
          __overrides_unparsed__: ['--notNxArg', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs
    ).toEqual({
      base: 'sha1',
      head: 'sha2',
      skipNxCache: false,
      skipRemoteCache: false,
    });
  });

  it('should put every command start with nx to nxArgs', () => {
    const nxArgs = splitArgsIntoNxArgsAndOverrides(
      {
        nxBail: 'some-value',
        __overrides_unparsed__: ['--override'],
        $0: '',
      },
      'affected',
      {} as any,
      {} as any
    ).nxArgs;
    expect(nxArgs['nxBail']).toEqual('some-value');
  });

  it('should default to having a base of main', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          __overrides_unparsed__: ['--notNxArg', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs
    ).toEqual({
      base: 'main',
      skipNxCache: false,
      skipRemoteCache: false,
    });
  });

  it('should return configured base branch from nx.json', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          __overrides_unparsed__: ['--notNxArg', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        { affected: { defaultBase: 'develop' } }
      ).nxArgs
    ).toEqual({
      base: 'develop',
      skipNxCache: false,
      skipRemoteCache: false,
    });
  });

  it('should return a default base branch if not configured in nx.json', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          __overrides_unparsed__: ['--notNxArg', 'affecteda', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs
    ).toEqual({
      base: 'main',
      skipNxCache: false,
      skipRemoteCache: false,
    });
  });

  it('should split non nx specific arguments into target args', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          files: [''],
          __overrides_unparsed__: ['--notNxArg'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      __overrides_unparsed__: ['--notNxArg'],
      notNxArg: true,
    });
  });

  it('should split non nx specific arguments into target args (with positonal args)', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          files: [''],
          __overrides_unparsed__: ['positional', '--notNxArg'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      _: ['positional'],
      __overrides_unparsed__: ['positional', '--notNxArg'],
      notNxArg: true,
    });
  });

  it('should only use explicitly provided overrides', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          files: [''],
          __overrides_unparsed__: ['explicit'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      __overrides_unparsed__: ['explicit'],
      _: ['explicit'],
    });
  });

  it('should be able to parse arguments in __overrides__', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          files: [''],
          __overrides__: ['explicit'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      __overrides_unparsed__: ['explicit'],
      _: ['explicit'],
    });
  });

  it('should split projects when it is a string', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          projects: 'aaa,bbb',
          __overrides_unparsed__: [],
          $0: '',
        },
        'run-many',
        {} as any,
        {} as any
      ).nxArgs
    ).toEqual({
      projects: ['aaa', 'bbb'],
      skipNxCache: false,
      skipRemoteCache: false,
    });
  });

  it('should set base and head based on environment variables in affected mode, if they are not provided directly on the command', () => {
    withEnvironment(
      {
        NX_BASE: 'envVarSha1',
        NX_HEAD: 'envVarSha2',
      },
      () => {
        expect(
          splitArgsIntoNxArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notNxArg', 'true', '--override'],
              $0: '',
            },
            'affected',
            {} as any,
            {} as any
          ).nxArgs
        ).toEqual({
          base: 'envVarSha1',
          head: 'envVarSha2',
          skipNxCache: false,
          skipRemoteCache: false,
        });

        expect(
          splitArgsIntoNxArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notNxArg', 'true', '--override'],
              $0: '',
              head: 'directlyOnCommandSha1', // higher priority than $NX_HEAD
            },
            'affected',
            {} as any,
            {} as any
          ).nxArgs
        ).toEqual({
          base: 'envVarSha1',
          head: 'directlyOnCommandSha1',
          skipNxCache: false,
          skipRemoteCache: false,
        });

        expect(
          splitArgsIntoNxArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notNxArg', 'true', '--override'],
              $0: '',
              base: 'directlyOnCommandSha2', // higher priority than $NX_BASE
            },
            'affected',
            {} as any,
            {} as any
          ).nxArgs
        ).toEqual({
          base: 'directlyOnCommandSha2',
          head: 'envVarSha2',
          skipNxCache: false,
          skipRemoteCache: false,
        });
      }
    );
  });

  describe('--runner environment handling', () => {
    it('should set runner based on environment NX_TASKS_RUNNER, if it is not provided directly on the command', () => {
      withEnvironment({ NX_TASKS_RUNNER: 'some-env-runner-name' }, () => {
        expect(
          splitArgsIntoNxArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notNxArg', 'true', '--override'],
              $0: '',
            },
            'run-one',
            {} as any,
            {
              tasksRunnerOptions: {
                'some-env-runner-name': { runner: '' },
              },
            }
          ).nxArgs.runner
        ).toEqual('some-env-runner-name');

        expect(
          splitArgsIntoNxArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notNxArg', 'true', '--override'],
              $0: '',
              runner: 'directlyOnCommand', // higher priority than $NX_RUNNER
            },
            'run-one',
            {} as any,
            {
              tasksRunnerOptions: {
                'some-env-runner-name': { runner: '' },
              },
            }
          ).nxArgs.runner
        ).toEqual('directlyOnCommand');
      });
    });

    it('should prefer NX_TASKS_RUNNER', () => {
      withEnvironment(
        {
          NX_TASKS_RUNNER: 'some-env-runner-name',
          NX_RUNNER: 'some-other-runner',
        },
        () => {
          expect(
            splitArgsIntoNxArgsAndOverrides(
              {
                __overrides_unparsed__: ['--notNxArg', 'true', '--override'],
                $0: '',
              },
              'run-one',
              {} as any,
              {
                tasksRunnerOptions: {
                  'some-env-runner-name': { runner: '' },
                  'some-other-runner': { runner: '' },
                },
              }
            ).nxArgs.runner
          ).toEqual('some-env-runner-name');
        }
      );
    });

    it('should ignore runners based on environment, if it is valid', () => {
      withEnvironment(
        {
          NX_TASKS_RUNNER: 'some-env-runner-name',
          NX_RUNNER: 'some-other-runner',
        },
        () => {
          expect(
            splitArgsIntoNxArgsAndOverrides(
              {
                __overrides_unparsed__: ['--notNxArg', 'true', '--override'],
                $0: '',
              },
              'run-one',
              {} as any,
              {} as any
            ).nxArgs.runner
          ).not.toBeDefined();
        }
      );
    });
  });

  describe('--parallel', () => {
    it('should be a number', () => {
      const parallel = splitArgsIntoNxArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '5',
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs.parallel;

      expect(parallel).toEqual(5);
    });

    it('should default to 3 when used with no value specified', () => {
      const parallel = splitArgsIntoNxArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '',
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs.parallel;

      expect(parallel).toEqual(3);
    });

    it('should be 3 when set to true', () => {
      const parallel = splitArgsIntoNxArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: 'true',
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs.parallel;

      expect(parallel).toEqual(3);
    });

    it('should be 1 when set to false', () => {
      const parallel = splitArgsIntoNxArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: 'false',
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs.parallel;

      expect(parallel).toEqual(1);
    });

    it('should use the maxParallel option when given', () => {
      const parallel = splitArgsIntoNxArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '',
          maxParallel: 5,
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs.parallel;

      expect(parallel).toEqual(5);
    });

    it('should use the maxParallel option when given', () => {
      const parallel = splitArgsIntoNxArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '',
          maxParallel: 5,
        },
        'affected',
        {} as any,
        {} as any
      ).nxArgs.parallel;

      expect(parallel).toEqual(5);
    });

    it('should be able to be specified in the environment', () => {
      const { nxArgs } = withEnvironment(
        {
          NX_PARALLEL: '5',
        },
        () =>
          splitArgsIntoNxArgsAndOverrides(
            {
              $0: '',
              __overrides_unparsed__: [],
            },
            'affected',
            {} as any,
            {} as any
          )
      );
      expect(nxArgs.parallel).toEqual(5);
    });

    it('should be able to override NX_PARALLEL with the parallel flag', () => {
      const { nxArgs } = withEnvironment(
        {
          NX_PARALLEL: '5',
        },
        () =>
          splitArgsIntoNxArgsAndOverrides(
            {
              $0: '',
              __overrides_unparsed__: [],
              parallel: '3',
            },
            'affected',
            {} as any,
            {} as any
          )
      );
      expect(nxArgs.parallel).toEqual(3);
    });
  });

  describe('resolving the affected base against git', () => {
    const execFileSyncMock = execFileSync as jest.Mock;
    const execSyncMock = execSync as jest.Mock;

    function splitAffectedArgs(args: Record<string, any>, nxJson = {}) {
      return splitArgsIntoNxArgsAndOverrides(
        { $0: '', __overrides_unparsed__: [], ...args },
        'affected',
        { printWarnings: false },
        nxJson as any
      );
    }

    beforeEach(() => {
      execFileSyncMock.mockReturnValue(Buffer.from('a1b2c3d\n'));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should resolve the merge base by passing revisions as arguments rather than through a shell', () => {
      splitAffectedArgs({ base: 'main', head: 'HEAD' });

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['merge-base', 'main', 'HEAD'],
        expect.anything()
      );
    });

    it('should treat a shell substitution in --base as an opaque revision instead of executing it', () => {
      const { nxArgs } = splitAffectedArgs({ base: '$(touch /tmp/nx-pwned)' });

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['merge-base', '$(touch /tmp/nx-pwned)', 'HEAD'],
        expect.anything()
      );
      expect(nxArgs.base).toEqual('a1b2c3d');
    });

    it('should treat a shell substitution in nx.json defaultBase as an opaque revision', () => {
      splitAffectedArgs({}, { defaultBase: '$(touch /tmp/nx-pwned)' });

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['merge-base', '$(touch /tmp/nx-pwned)', 'HEAD'],
        expect.anything()
      );
    });

    it('should treat a shell substitution in NX_BASE as an opaque revision', () => {
      withEnvironment({ NX_BASE: '$(touch /tmp/nx-pwned)' }, () =>
        splitAffectedArgs({})
      );

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['merge-base', '$(touch /tmp/nx-pwned)', 'HEAD'],
        expect.anything()
      );
    });

    it('should reject an option-like base before invoking git', () => {
      expect(() => splitAffectedArgs({ base: '--upload-pack=id' })).toThrow(
        /Invalid git revision/
      );
      expect(execFileSyncMock).not.toHaveBeenCalled();
    });

    it('should reject an option-like head before invoking git', () => {
      expect(() =>
        splitAffectedArgs({ base: 'main', head: '--upload-pack=id' })
      ).toThrow(/Invalid git revision/);
      expect(execFileSyncMock).not.toHaveBeenCalled();
    });

    it('should reject an option-like defaultBase from nx.json before invoking git', () => {
      expect(() =>
        splitAffectedArgs({}, { defaultBase: '--upload-pack=id' })
      ).toThrow(/Invalid git revision/);
      expect(execFileSyncMock).not.toHaveBeenCalled();
    });

    it('should fall back to the fork point without a shell when merge-base fails', () => {
      execFileSyncMock.mockImplementationOnce(() => {
        throw new Error('no merge base');
      });

      splitAffectedArgs({ base: 'main' });

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(execFileSyncMock).toHaveBeenLastCalledWith(
        'git',
        ['merge-base', '--fork-point', 'main', 'HEAD'],
        expect.anything()
      );
    });

    it('should fall back to the given base when git cannot resolve it', () => {
      execFileSyncMock.mockImplementation(() => {
        throw new Error('unknown revision');
      });

      const { nxArgs } = splitAffectedArgs({ base: 'some-branch' });

      expect(nxArgs.base).toEqual('some-branch');
    });
  });
});
