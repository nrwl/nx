import { splitArgsIntoNxArgsAndOverrides } from './command-line-utils';

jest.mock('../project-graph/file-utils');

describe('splitArgs', () => {
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
    });
  });

  it('should set base and head based on environment variables in affected mode, if they are not provided directly on the command', () => {
    const originalNxBase = process.env.NX_BASE;
    process.env.NX_BASE = 'envVarSha1';
    const originalNxHead = process.env.NX_HEAD;
    process.env.NX_HEAD = 'envVarSha2';

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
    });

    // Reset process data
    process.env.NX_BASE = originalNxBase;
    process.env.NX_HEAD = originalNxHead;
  });

  it('should set runner based on environment variables, if it is not provided directly on the command', () => {
    const originalRunner = process.env.NX_RUNNER;
    process.env.NX_RUNNER = 'some-env-runner-name';

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
        {} as any
      ).nxArgs.runner
    ).toEqual('directlyOnCommand');

    // Reset process data
    process.env.NX_RUNNER = originalRunner;
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

    it('should default to 3', () => {
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
  });
});
