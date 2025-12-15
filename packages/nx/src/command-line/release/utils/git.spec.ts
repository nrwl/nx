import {
  extractReferencesFromCommit,
  getLatestGitTagForPattern,
  RepoGitTags,
  sanitizeProjectNameForGitTag,
} from './git';

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
my-lib-5@1.1.1
my-lib-5@1.1.0-alpha.3
my-lib-5@1.1.0-alpha.2
my-lib-5@1.1.0
lib-only-pre-release@1.2.4-beta.1
lib-only-pre-release@1.2.4-beta.1+build.1
my-group@1.5.0
release/common/iam-client/1.0.0
release/apps/backend/api/2.0.0
gradle/common/lib@1.5.0
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
      RepoGitTags.instance.clean();
    });

    describe('when releaseTagPatternStrictPreid is false', () => {
      const releaseTagPatternTestCases = [
        {
          pattern: 'v{version}',
          projectName: 'my-lib-1',
          expectedTag: 'v4.0.1',
          expectedVersion: '4.0.1',
          requireSemver: true,
        },
        {
          pattern: 'x{version}',
          projectName: 'my-lib-1',
          expectedTag: 'x5.0.0',
          expectedVersion: '5.0.0',
          requireSemver: true,
        },
        {
          pattern: 'release/{version}',
          projectName: 'my-lib-1',
          expectedTag: 'release/4.2.1',
          expectedVersion: '4.2.1',
          requireSemver: true,
        },
        {
          pattern: 'release/{projectName}@v{version}',
          projectName: 'my-lib-1',
          expectedTag: 'release/my-lib-1@v4.2.1',
          expectedVersion: '4.2.1',
          requireSemver: true,
        },
        {
          pattern: '{version}',
          projectName: 'my-lib-1',
          expectedTag: '4.0.0-rc.1+build.1',
          expectedVersion: '4.0.0-rc.1+build.1',
          requireSemver: true,
        },
        {
          pattern: '{projectName}@v{version}',
          projectName: 'my-lib-1',
          expectedTag: 'my-lib-1@v4.0.0-beta.1',
          expectedVersion: '4.0.0-beta.1',
          requireSemver: true,
        },
        {
          pattern: '{projectName}v{version}',
          projectName: 'my-lib-2',
          expectedTag: 'my-lib-2v4.0.0-beta.1',
          expectedVersion: '4.0.0-beta.1',
          requireSemver: true,
        },
        {
          pattern: '{projectName}{version}',
          projectName: 'my-lib-3',
          expectedTag: 'my-lib-34.0.0-beta.1',
          expectedVersion: '4.0.0-beta.1',
          requireSemver: true,
        },
        {
          pattern: '{version}-{projectName}',
          projectName: 'my-lib-1',
          expectedTag: '4.0.0-beta.0-my-lib-1',
          expectedVersion: '4.0.0-beta.0',
          requireSemver: true,
        },
        {
          pattern: '{version}-{projectName}',
          projectName: 'alpha',
          expectedTag: '3.0.0-beta.0-alpha',
          expectedVersion: '3.0.0-beta.0',
          requireSemver: true,
        },
        {
          pattern: 'hotfix/{projectName}/{version}',
          projectName: 'api',
          expectedTag: 'hotfix/api/2506.30.abcdef',
          expectedVersion: '2506.30.abcdef',
          requireSemver: false,
        },
        {
          pattern: 'release/{projectName}/{version}',
          projectName: 'api',
          expectedTag: 'release/api/2506.30.abcdef',
          expectedVersion: '2506.30.abcdef',
          requireSemver: false,
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preid: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preid: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          expectedTag: 'alpha-lib@1.2.4',
          expectedVersion: '1.2.4',
          preid: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          expectedTag: 'alpha-lib@1.2.4',
          expectedVersion: '1.2.4',
          preid: 'beta',
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
          preid: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: 'lib-only-pre-release@1.2.4-beta.1',
          expectedVersion: '1.2.4-beta.1',
          preid: 'alpha',
        },
        {
          pattern: '{releaseGroupName}@{version}',
          releaseGroupName: 'my-group',
          projectName: 'my-project',
          expectedTag: 'my-group@1.5.0',
          expectedVersion: '1.5.0',
          requireSemver: true,
        },
        // Gradle-style project names (sanitized before being passed to this function)
        // The caller (e.g., release-graph.ts) is responsible for sanitizing project names
        {
          pattern: 'release/{projectName}/{version}',
          projectName: sanitizeProjectNameForGitTag(':common:iam-client'), // Sanitized from Gradle-style
          expectedTag: 'release/common/iam-client/1.0.0',
          expectedVersion: '1.0.0',
          requireSemver: true,
        },
        {
          pattern: 'release/{projectName}/{version}',
          projectName: sanitizeProjectNameForGitTag(':apps:backend:api'), // Sanitized from nested Gradle module
          expectedTag: 'release/apps/backend/api/2.0.0',
          expectedVersion: '2.0.0',
          requireSemver: true,
        },
        {
          pattern: 'gradle/{projectName}@{version}',
          projectName: sanitizeProjectNameForGitTag(':common:lib'), // Sanitized
          expectedTag: 'gradle/common/lib@1.5.0',
          expectedVersion: '1.5.0',
          requireSemver: true,
        },
      ];

      it.each(releaseTagPatternTestCases)(
        'should return tag $expectedTag for pattern $pattern and preid $preid',
        async ({
          pattern,
          projectName,
          releaseGroupName,
          expectedTag,
          expectedVersion,
          requireSemver,
          preid,
        }) => {
          const result = await getLatestGitTagForPattern(
            pattern,
            {
              projectName,
              releaseGroupName,
            },
            {
              requireSemver,
              preid: preid,
              strictPreid: false,
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
          preid: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-4',
          expectedTag: 'my-lib-4@1.2.4-alpha.1',
          expectedVersion: '1.2.4-alpha.1',
          preid: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          expectedTag: 'alpha-lib@1.2.4',
          expectedVersion: '1.2.4',
          preid: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'alpha-lib',
          // Alpha lib has a stable 1.2.4 release, so this should be returned regardless of preid
          expectedTag: 'alpha-lib@1.2.4',
          expectedVersion: '1.2.4',
          preid: 'beta',
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
          preid: 'beta',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'lib-only-pre-release',
          expectedTag: undefined,
          expectedVersion: undefined,
          preid: 'alpha',
        },
        {
          pattern: '{projectName}@{version}',
          projectName: 'my-lib-5',
          expectedTag: 'my-lib-5@1.1.1',
          expectedVersion: '1.1.1',
          preid: 'alpha',
        },
      ];

      it.each(releaseTagPatternTestCases)(
        'should return tag $expectedTag for pattern $pattern and preid $preid',
        async ({
          pattern,
          projectName,
          expectedTag,
          expectedVersion,
          preid,
        }) => {
          const result = await getLatestGitTagForPattern(
            pattern,
            {
              projectName,
            },
            {
              preid: preid,
              requireSemver: true,
              strictPreid: true,
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
          requireSemver: true,
          strictPreid: false,
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
          requireSemver: true,
          strictPreid: false,
        }
      );

      expect(result).toEqual(null);
    });
  });

  describe('sanitizeProjectNameForGitTag', () => {
    it('should replace colons with slashes for Gradle-style module paths', () => {
      expect(
        sanitizeProjectNameForGitTag(':common:iam-enterprise-directory-client')
      ).toBe('common/iam-enterprise-directory-client');
    });

    it('should handle leading colon (Gradle root module indicator)', () => {
      expect(sanitizeProjectNameForGitTag(':my-module')).toBe('my-module');
    });

    it('should handle multiple consecutive colons', () => {
      expect(sanitizeProjectNameForGitTag('a::b:::c')).toBe('a/b/c');
    });

    it('should replace space with hyphen', () => {
      expect(sanitizeProjectNameForGitTag('my project')).toBe('my-project');
    });

    it('should replace tilde with hyphen', () => {
      expect(sanitizeProjectNameForGitTag('my~project')).toBe('my-project');
    });

    it('should replace caret with hyphen', () => {
      expect(sanitizeProjectNameForGitTag('my^project')).toBe('my-project');
    });

    it('should replace question mark with hyphen', () => {
      expect(sanitizeProjectNameForGitTag('my?project')).toBe('my-project');
    });

    it('should replace asterisk with hyphen', () => {
      expect(sanitizeProjectNameForGitTag('my*project')).toBe('my-project');
    });

    it('should replace left bracket with hyphen', () => {
      expect(sanitizeProjectNameForGitTag('my[project')).toBe('my-project');
    });

    it('should replace backslash with hyphen', () => {
      expect(sanitizeProjectNameForGitTag('my\\project')).toBe('my-project');
    });

    it('should collapse consecutive dots', () => {
      expect(sanitizeProjectNameForGitTag('my..project')).toBe('my.project');
    });

    it('should pass through valid project names unchanged', () => {
      expect(sanitizeProjectNameForGitTag('my-valid-project')).toBe(
        'my-valid-project'
      );
      expect(sanitizeProjectNameForGitTag('my_valid_project')).toBe(
        'my_valid_project'
      );
      expect(sanitizeProjectNameForGitTag('my.valid.project')).toBe(
        'my.valid.project'
      );
    });

    it('should handle complex Gradle multi-module names', () => {
      expect(sanitizeProjectNameForGitTag(':apps:backend:api-service')).toBe(
        'apps/backend/api-service'
      );
    });
  });
});
