import { splitArgsIntoNxArgsAndOverrides, getAffectedConfig } from './utils';
import * as fileUtils from '../core/file-utils';

jest.mock('../core/file-utils');

describe('splitArgs', () => {
  beforeEach(() => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnThis();
  });
  it('should split nx specific arguments into nxArgs', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          base: 'sha1',
          head: 'sha2',
          notNxArg: true,
          _: ['--override'],
          $0: '',
        },
        'affected'
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
        'nx-key': 'some-value',
        nxKey: 'some-value',
        _: ['--override'],
        $0: '',
      },
      'affected'
    ).nxArgs;
    expect(nxArgs['nx-key']).toEqual('some-value');
    expect(nxArgs['nxKey']).toEqual('some-value');
  });

  it('should default to having a base of master', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          notNxArg: true,
          _: ['--override'],
          $0: '',
        },
        'affected'
      ).nxArgs
    ).toEqual({
      base: 'master',
      skipNxCache: false,
    });
  });

  it('should return configured base branch from nx.json', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnValue({
      npmScope: 'testing',
      affected: {
        defaultBase: 'develop',
      },
      projects: {},
    });
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          notNxArg: true,
          _: ['--override'],
          $0: '',
        },
        'affected'
      ).nxArgs
    ).toEqual({
      base: 'develop',
      skipNxCache: false,
    });
  });

  it('should return a default base branch if not configured in nx.json', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnValue({
      npmScope: 'testing',
      projects: {},
    });
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          notNxArg: true,
          _: ['--override'],
          $0: '',
        },
        'affected'
      ).nxArgs
    ).toEqual({
      base: 'master',
      skipNxCache: false,
    });
  });

  it('should split non nx specific arguments into target args', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          files: [''],
          notNxArg: true,
          _: ['--override'],
          $0: '',
        },
        'affected'
      ).overrides
    ).toEqual({
      notNxArg: true,
      override: true,
    });
  });

  it('should set base and head in the affected mode', () => {
    const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
      {
        notNxArg: true,
        _: ['sha1', 'sha2', '--override'],
        $0: '',
      },
      'affected'
    );

    expect(nxArgs).toEqual({
      base: 'sha1',
      head: 'sha2',
      skipNxCache: false,
    });
    expect(overrides).toEqual({
      notNxArg: true,
      override: true,
    });
  });

  it('should not set base and head in the run-one mode', () => {
    const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
      {
        notNxArg: true,
        _: ['--exclude=file'],
        $0: '',
      },
      'run-one'
    );

    expect(nxArgs).toEqual({
      skipNxCache: false,
    });
    expect(overrides).toEqual({
      notNxArg: true,
      exclude: 'file',
    });
  });
});

describe('getAffectedConfig', () => {
  it('should return defaults when affected is undefined in nx.json', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnThis();

    expect(getAffectedConfig().defaultBase).toEqual('master');
  });

  it('should return default base branch when its defined in nx.json', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnValue({
      npmScope: 'testing',
      affected: {
        defaultBase: 'testing',
      },
      projects: {},
    });

    expect(getAffectedConfig().defaultBase).toEqual('testing');
  });
});
