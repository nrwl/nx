import { splitArgsIntoNxArgsAndOverrides } from './utils';

describe('splitArgs', () => {
  it('should split nx specific arguments into nxArgs', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          base: 'sha1',
          head: 'sha2',
          notNxArg: true,
          _: ['--override'],
          $0: ''
        },
        'affected'
      ).nxArgs
    ).toEqual({
      base: 'sha1',
      head: 'sha2',
      projects: [],
      skipNxCache: false
    });
  });

  it('should default to having a base of master', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          notNxArg: true,
          _: ['--override'],
          $0: ''
        },
        'affected'
      ).nxArgs
    ).toEqual({
      base: 'master',
      projects: [],
      skipNxCache: false
    });
  });

  it('should split non nx specific arguments into target args', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides(
        {
          files: [''],
          notNxArg: true,
          _: ['--override'],
          $0: ''
        },
        'affected'
      ).overrides
    ).toEqual({
      notNxArg: true,
      override: true
    });
  });

  it('should add other args to nx args', () => {
    const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
      {
        notNxArg: true,
        _: ['sha1', 'sha2', '--override'],
        $0: ''
      },
      'affected'
    );

    expect(nxArgs).toEqual({
      base: 'sha1',
      head: 'sha2',
      projects: [],
      skipNxCache: false
    });
    expect(overrides).toEqual({
      notNxArg: true,
      override: true
    });
  });
});
