import { splitArgsIntoNxArgsAndOverrides, getDefaultBranch } from './utils';
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

  it('should read base of develop from nx.json', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnValue({
      npmScope: 'testing',
      defaultBranch: 'develop',
      projects: {}
    });
    expect(
      splitArgsIntoNxArgsAndOverrides({
        notNxArg: true,
        _: ['--override'],
        $0: ''
      }).nxArgs
    ).toEqual({
      base: 'develop',
      projects: []
    });
  });

  it('should not find a base in nx.json returns master', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnValue({
      npmScope: 'testing',
      projects: {}
    });
    expect(
      splitArgsIntoNxArgsAndOverrides({
        notNxArg: true,
        _: ['--override'],
        $0: ''
      }).nxArgs
    ).toEqual({
      base: 'master',
      projects: []
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

describe('getDefaultBranch', () => {
  it('should return undefined when defaultBranch is undefined in nx.json', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnThis();
    expect(getDefaultBranch()).toEqual('master');
  });

  it('should return default branch when its defined in nx.json', () => {
    jest.spyOn(fileUtils, 'readNxJson').mockReturnValue({
      npmScope: 'testing',
      defaultBranch: 'testing',
      projects: {}
    });
    expect(getDefaultBranch()).toEqual('testing');
  });
});
