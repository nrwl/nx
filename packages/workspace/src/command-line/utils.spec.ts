import { splitArgsIntoNxArgsAndOverrides } from './utils';

describe('splitArgs', () => {
  it('should split nx specific arguments into nxArgs', () => {
    expect(
      splitArgsIntoNxArgsAndOverrides({
        files: [''],
        notNxArg: true,
        _: ['--override'],
        $0: ''
      }).nxArgs
    ).toEqual({
      projects: [],
      files: ['']
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
});
