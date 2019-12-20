import { splitArgsIntoNxArgsAndOverrides } from './utils';

describe('splitArgs', () => {
  it('should split nx specific arguments into nxArgs', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides({
        base: 'sha1',
        head: 'sha2',
        notNxArg: true,
        _: ['--override'],
        $0: ''
      }).nxArgs
    ).toEqual({
      base: 'sha1',
      head: 'sha2',
      projects: []
    });
  });

  it('should default to having a base of master', () => {
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
      splitArgsIntoNxArgsAndOverrides({
        files: [''],
        notNxArg: true,
        _: ['--override'],
        $0: ''
      }).overrides
    ).toEqual({
      notNxArg: true,
      override: true
    });
  });

  it('should add other args to nx args', () => {
    const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides({
      notNxArg: true,
      _: ['sha1', 'sha2', '--override'],
      $0: ''
    });

    expect(nxArgs).toEqual({
      base: 'sha1',
      head: 'sha2',
      projects: []
    });
    expect(overrides).toEqual({
      notNxArg: true,
      override: true
    });
  });
});
