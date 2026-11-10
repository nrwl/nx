import { createCliOptions } from './create-cli-options';

describe('createCliOptions', () => {
  it('should kebab-case keys and emit booleans as bare flags', () => {
    expect(
      createCliOptions({ maxWarnings: 0, fix: true, typeAware: true })
    ).toEqual(['--max-warnings=0', '--fix', '--type-aware']);
  });

  it('should skip false, null and undefined', () => {
    expect(
      createCliOptions({ quiet: false, config: undefined, tsconfig: null })
    ).toEqual([]);
  });

  it('should repeat the flag for array values', () => {
    expect(createCliOptions({ ignorePattern: ['a/**', 'b/**'] })).toEqual([
      '--ignore-pattern=a/**',
      '--ignore-pattern=b/**',
    ]);
  });
});
