import type { TargetConfiguration } from 'nx/src/devkit-exports';
import { TempFs } from '../../internal-testing-utils';
import { applyTestFileDirectives } from './test-file-directives';

describe('applyTestFileDirectives', () => {
  let temp: TempFs;
  const target: TargetConfiguration = {
    command: 'vitest run src/a.spec.ts',
    inputs: ['default', '^production'],
  };

  beforeEach(() => {
    temp = new TempFs('test-file-directives');
  });

  afterEach(() => {
    temp.cleanup();
  });

  it('leaves the target unchanged when the test file no longer exists', () => {
    expect(
      applyTestFileDirectives(target, temp.tempDir, 'src/a.spec.ts', {
        ignoreServerInputs: false,
      })
    ).toEqual(target);
  });

  it('throws when the test file cannot be read for another reason', () => {
    expect(() =>
      applyTestFileDirectives(target, temp.tempDir, 'src/a\0.spec.ts', {
        ignoreServerInputs: false,
      })
    ).toThrow(expect.objectContaining({ code: 'ERR_INVALID_ARG_VALUE' }));
  });
});
