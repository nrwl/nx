import { splitArgsIntoNxArgsAndTargetArgs } from './utils';

describe('splitArgs', () => {
  it('should split nx specific arguments into nxArgs', () => {
    expect(
      splitArgsIntoNxArgsAndTargetArgs({
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
      splitArgsIntoNxArgsAndTargetArgs({
        files: [''],
        notNxArg: true,
        _: ['--override'],
        $0: ''
      }).targetArgs
    ).toEqual({
      notNxArg: true,
      override: true
    });
  });
});
