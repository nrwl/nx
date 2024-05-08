import { NxReleaseConfig } from '../config/config';
import { DEFAULT_CONVENTIONAL_COMMITS_CONFIG } from '../config/conventional-commits';
import { GitCommit } from './git';
import { deriveNewSemverVersion, determineSemverChange } from './semver';

describe('semver', () => {
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
  // tests for determineSemverChange()
  describe('determineSemverChange()', () => {
    const config: NxReleaseConfig['conventionalCommits'] = {
      types: {
        feat: {
          semverBump: 'minor',
          changelog: DEFAULT_CONVENTIONAL_COMMITS_CONFIG.types.feat.changelog,
        },
        fix: {
          semverBump: 'patch',
          changelog: DEFAULT_CONVENTIONAL_COMMITS_CONFIG.types.fix.changelog,
        },
        chore: {
          semverBump: 'patch',
          changelog: DEFAULT_CONVENTIONAL_COMMITS_CONFIG.types.chore.changelog,
        },
      },
    };

    const featNonBreakingCommit: GitCommit = {
      type: 'feat',
      isBreaking: false,
    } as GitCommit;
    const featBreakingCommit: GitCommit = {
      type: 'feat',
      isBreaking: true,
    } as GitCommit;
    const fixCommit: GitCommit = {
      type: 'fix',
      isBreaking: false,
    } as GitCommit;
    const choreCommit: GitCommit = {
      type: 'chore',
      isBreaking: false,
    } as GitCommit;
    const unknownTypeCommit: GitCommit = {
      type: 'perf',
      isBreaking: false,
    } as GitCommit;
    const unknownTypeBreakingCommit: GitCommit = {
      type: 'perf',
      isBreaking: true,
    } as GitCommit;

    it('should return the highest bump level of all commits', () => {
      expect(
        determineSemverChange(
          [fixCommit, featNonBreakingCommit, choreCommit],
          config
        )
      ).toEqual('minor');
    });

    it('should return major if any commits are breaking', () => {
      expect(
        determineSemverChange(
          [fixCommit, featBreakingCommit, featNonBreakingCommit, choreCommit],
          config
        )
      ).toEqual('major');
    });

    it('should return major if any commits (including unknown types) are breaking', () => {
      expect(
        determineSemverChange(
          [
            fixCommit,
            unknownTypeBreakingCommit,
            featNonBreakingCommit,
            choreCommit,
          ],
          config
        )
      ).toEqual('major');
    });

    it('should return patch when given only patch commits, ignoring unknown types', () => {
      expect(
        determineSemverChange(
          [fixCommit, choreCommit, unknownTypeCommit],
          config
        )
      ).toEqual('patch');
    });

    it('should return null when given only unknown type commits', () => {
      expect(determineSemverChange([unknownTypeCommit], config)).toEqual(null);
    });
  });
});
