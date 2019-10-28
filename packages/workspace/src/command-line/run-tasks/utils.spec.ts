import { splitArgs } from './utils';

describe('splitArgs', () => {
  it('should split nx specific arguments into nxArgs', () => {
    expect(
      splitArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['--override'],
          $0: ''
        },
        ['files']
      ).nxArgs
    ).toEqual({
      files: ['']
    });
  });

  it('should split non nx specific arguments into target args', () => {
    expect(
      splitArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['--override'],
          $0: ''
        },
        ['files']
      ).targetArgs
    ).toEqual({
      notNxArg: true
    });
  });

  it('should split delimited args into task overrides', () => {
    expect(
      splitArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['', '--override'],
          $0: ''
        },
        ['files']
      ).overrides
    ).toEqual({
      override: true
    });
  });
});
