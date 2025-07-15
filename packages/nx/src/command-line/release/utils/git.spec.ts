import { extractReferencesFromCommit, getLatestGitTagForPattern } from './git';

jest.mock('./exec-command', () => ({
  execCommand: jest.fn(() =>
    Promise.resolve(`
x5.0.0
release/4.😐2.2
release/4.2.1
release/my-lib-1@v4.2.1
v4.0.1
4.0.0-rc.1+build.1
v4.0.0-beta.1
my-lib-1@v4.0.0-beta.1
my-lib-2v4.0.0-beta.1
my-lib-34.0.0-beta.1
4.0.0-beta.0-my-lib-1
3.0.0-beta.0-alpha
1.0.0
hotfix/api/2506.30.abcdef
release/api/2506.30.abcdef
my-lib-4@1.2.4-beta.1
my-lib-4@1.2.4-alpha.1
my-lib-4@1.2.3
alpha-lib@1.2.4
alpha-lib@1.2.4-beta.1
lib-only-pre-release@1.2.4-beta.1
lib-only-pre-release@1.2.4-beta.1+build.1
`)
  ),
}));

describe('git utils', () => {
  describe('extractReferencesFromCommit', () => {
    it('should include the given short commit hash even if no other references are found', () => {
      const references = extractReferencesFromCommit({
        message: 'test',
        body: '',
        shortHash: 'abc123',
        author: { name: 'Test Author', email: 'test@example.com' },
      });
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "type": "hash",
            "value": "abc123",
          },
        ]
      `);
    });

    it('should match GitHub style issue references', () => {
      const references = extractReferencesFromCommit({
        message: 'This fixed issue #789',
        body: '',
        shortHash: 'abc123',
        author: { name: 'Test Author', email: 'test@example.com' },
      });
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "type": "issue",
            "value": "#789",
          },
          {
            "type": "hash",
            "value": "abc123",
          },
        ]
      `);
    });

    it('should match GitHub style PR references', () => {
      const references = extractReferencesFromCommit({
        message: 'fix: all the things (#20607)',
        body: '',
        shortHash: 'abc123',
        author: { name: 'Test Author', email: 'test@example.com' },
      });
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "type": "pull-request",
            "value": "#20607",
          },
          {
            "type": "hash",
            "value": "abc123",
          },
        ]
      `);
    });

    it('should match GitLab style issue references', () => {
      const references = extractReferencesFromCommit({
        message: "Merge branch 'mr-to-fix-issue' into 'main'",
        body: `fix: this should resolve the gitlab issue

Closes #1`,
        shortHash: 'abc123',
        author: { name: 'Test Author', email: 'test@example.com' },
      });
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "type": "issue",
            "value": "#1",
          },
          {
            "type": "hash",
            "value": "abc123",
          },
        ]
      `);
    });

    it('should match GitLab style merge request references', () => {
      const references = extractReferencesFromCommit({
        message: "Merge branch 'mr-to-fix-issue' into 'main'",
        body: `fix: this should resolve the gitlab issue

See merge request nx-release-test/nx-release-test!2`,
        shortHash: 'abc123',
        author: { name: 'Test Author', email: 'test@example.com' },
      });
      expect(references).toMatchInlineSnapshot(`
        [
          {
            "type": "pull-request",
            "value": "!2",
          },
          {
            "type": "hash",
            "value": "abc123",
          },
        ]
      `);
    });
  });

  describe('getLatestGitTagForPattern', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('when releaseTagPatternStrictPreid is false', () => {
      const releaseTagPatternTestCases = [
        {
          pattern: 'v{version}',
          projectName: 'my-lib-1',
          expectedTag: 'v4.0.1',
          expectedVersion: '4.0.1',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: 'x{version}',
          projectName: 'my-lib-1',
          expectedTag: 'x5.0.0',
          expectedVersion: '5.0.0',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: 'release/{version}',
          projectName: 'my-lib-1',
          expectedTag: 'release/4.2.1',
          expectedVersion: '4.2.1',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: 'release/{projectName}@v{version}',
          projectName: 'my-lib-1',
          expectedTag: 'release/my-lib-1@v4.2.1',
          expectedVersion: '4.2.1',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: '{version}',
          projectName: 'my-lib-1',
          expectedTag: '4.0.0-rc.1+build.1',
          expectedVersion: '4.0.0-rc.1+build.1',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: '{projectName}@v{version}',
          projectName: 'my-lib-1',
          expectedTag: 'my-lib-1@v4.0.0-beta.1',
          expectedVersion: '4.0.0-beta.1',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: '{projectName}v{version}',
          projectName: 'my-lib-2',
          expectedTag: 'my-lib-2v4.0.0-beta.1',
          expectedVersion: '4.0.0-beta.1',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: '{projectName}{version}',
          projectName: 'my-lib-3',
          expectedTag: 'my-lib-34.0.0-beta.1',
          expectedVersion: '4.0.0-beta.1',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: '{version}-{projectName}',
          projectName: 'my-lib-1',
          expectedTag: '4.0.0-beta.0-my-lib-1',
          expectedVersion: '4.0.0-beta.0',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: '{version}-{projectName}',
          projectName: 'alpha',
          expectedTag: '3.0.0-beta.0-alpha',
          expectedVersion: '3.0.0-beta.0',
          releaseTagPatternRequireSemver: true,
        },
        {
          pattern: 'hotfix/{projectName}/{version}',
          projectName: 'api',
          expectedTag: 'hotfix/api/2506.30.abcdef',
          expectedVersion: '2506.30.abcdef',
          releaseTagPatternRequireSemver: false,
        },
        {
          pattern: 'release/{projectName}/{version}',
          projectName: 'api',
          expectedTag: 'release/api/2506.30.abcdef',
          expectedVersion: '2506.30.abcdef',
          releaseTagPatternRequireSemver: false,
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preId: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preId: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          expectedTag: 'alpha-lib@1.2.4',
          expectedVersion: '1.2.4',
          preId: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          expectedTag: 'alpha-lib@1.2.4',
          expectedVersion: '1.2.4',
          preId: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-no-tags',
          expectedTag: undefined,
          expectedVersion: undefined,
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: 'lib-only-pre-release@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: 'lib-only-pre-release@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preId: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: 'lib-only-pre-release@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preId: 'alpha',
        },
      ];

      it.each(releaseTagPatternTestCases)(
        'should return tag $expectedTag for pattern $pattern and preId $preId',
        async ({
          pattern,
          projectName,
          expectedTag,
          expectedVersion,
          releaseTagPatternRequireSemver,
          preId,
        }) => {
          const result = await getLatestGitTagForPattern(
            pattern,
            {
              projectName,
            },
            {
              releaseTagPatternRequireSemver,
              preId,
              releaseTagPatternStrictPreid: false,
            }
          );

          expect(result?.tag).toEqual(expectedTag);
          expect(result?.extractedVersion).toEqual(expectedVersion);
        }
      );
    });

    describe('when releaseTagPatternStrictPreid is true', () => {
      const releaseTagPatternTestCases = [
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preId: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-alpha.1',
          expectedVersion: '1.2.4-alpha.1',
          preId: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          expectedTag: 'alpha-lib@1.2.4',
          expectedVersion: '1.2.4',
          preId: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          expectedTag: 'alpha-lib@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preId: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.3',
          expectedVersion: '1.2.3',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-no-tags',
          expectedTag: undefined,
          expectedVersion: undefined,
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: undefined,
          expectedVersion: undefined,
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: 'lib-only-pre-release@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preId: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: undefined,
          expectedVersion: undefined,
          preId: 'alpha',
        },
      ];

      it.each(releaseTagPatternTestCases)(
        'should return tag $expectedTag for pattern $pattern and preId $preId',
        async ({
          pattern,
          projectName,
          expectedTag,
          expectedVersion,
          preId,
        }) => {
          const result = await getLatestGitTagForPattern(
            pattern,
            {
              projectName,
            },
            {
              preId,
              releaseTagPatternRequireSemver: true,
              releaseTagPatternStrictPreid: true,
            }
          );

          expect(result?.tag).toEqual(expectedTag);
          expect(result?.extractedVersion).toEqual(expectedVersion);
        }
      );
    });

    it('should return null if execCommand throws an error', async () => {
      // should return null if execCommand throws an error
      (
        require('./exec-command').execCommand as jest.Mock
      ).mockImplementationOnce(() => {
        throw new Error('error');
      });
      const result = await getLatestGitTagForPattern(
        '#{version}',
        {
          projectName: 'my-lib-1',
        },
        {
          releaseTagPatternRequireSemver: true,
          releaseTagPatternStrictPreid: false,
        }
      );
      expect(result).toEqual(null);
    });

    it('should return null if no tags match the pattern', async () => {
      const result = await getLatestGitTagForPattern(
        '#{version}',
        {
          projectName: 'my-lib-1',
        },
        {
          releaseTagPatternRequireSemver: true,
          releaseTagPatternStrictPreid: false,
        }
      );

      expect(result).toEqual(null);
    });
  });
});
