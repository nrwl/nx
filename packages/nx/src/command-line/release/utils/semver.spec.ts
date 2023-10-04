import { deriveNewSemverVersion } from './semver';

describe('deriveNewSemverVersion()', () => {
  const testCases = [
    {
      input: {
        currentVersion: '1.0.0',
        specifier: 'major',
      },
      expected: '2.0.0',
    },
    {
      input: {
        currentVersion: '1.0.0',
        specifier: 'minor',
      },
      expected: '1.1.0',
    },
    {
      input: {
        currentVersion: '1.0.0',
        specifier: 'patch',
      },
      expected: '1.0.1',
    },
    {
      input: {
        currentVersion: '1.0.0',
        specifier: '99.9.9', // exact version
      },
      expected: '99.9.9',
    },
    {
      input: {
        currentVersion: '1.0.0',
        specifier: '99.9.9', // exact version
      },
      expected: '99.9.9',
    },
  ];

  testCases.forEach((c, i) => {
    it(`should derive an appropriate semver version, CASE: ${i}`, () => {
      expect(
        deriveNewSemverVersion(c.input.currentVersion, c.input.specifier)
      ).toEqual(c.expected);
    });
  });

  it('should throw if the current version is not a valid semver version', () => {
    expect(() =>
      deriveNewSemverVersion('not-a-valid-semver-version', 'minor')
    ).toThrowErrorMatchingInlineSnapshot(
      `"Invalid semver version "not-a-valid-semver-version" provided."`
    );
    expect(() =>
      deriveNewSemverVersion('major', 'minor')
    ).toThrowErrorMatchingInlineSnapshot(
      `"Invalid semver version "major" provided."`
    );
  });

  it('should throw if the new version specifier is not a valid semver version or semver keyword', () => {
    expect(() =>
      deriveNewSemverVersion('1.0.0', 'foo')
    ).toThrowErrorMatchingInlineSnapshot(
      `"Invalid semver version specifier "foo" provided. Please provide either a valid semver version or a valid semver version keyword."`
    );
  });
});
