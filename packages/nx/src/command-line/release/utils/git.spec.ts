import { extractReferencesFromCommit, getLatestGitTagForPattern, isStableSemver } from './git';

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
my-lib-4@1.2.4-beta.1
my-lib-4@1.2.4-alpha.1
my-lib-4@1.2.3
alpha-lib@1.2.4
alpha-lib@1.2.4-beta.1
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

  const releaseTagPatternTestCases = [
    {
      pattern: 'v{version}',
      projectName: 'my-lib-1',
      expectedTag: 'v4.0.1',
      expectedVersion: '4.0.1',
    },
    {
      pattern: 'x{version}',
      projectName: 'my-lib-1',
      expectedTag: 'x5.0.0',
      expectedVersion: '5.0.0',
    },
    {
      pattern: 'release/{version}',
      projectName: 'my-lib-1',
      expectedTag: 'release/4.2.1',
      expectedVersion: '4.2.1',
    },
    {
      pattern: 'release/{projectName}@v{version}',
      projectName: 'my-lib-1',
      expectedTag: 'release/my-lib-1@v4.2.1',
      expectedVersion: '4.2.1',
    },
    {
      pattern: '{version}',
      projectName: 'my-lib-1',
      expectedTag: '4.0.0-rc.1+build.1',
      expectedVersion: '4.0.0-rc.1+build.1',
      preId: 'rc',
    },
    {
      pattern: '{projectName}@v{version}',
      projectName: 'my-lib-1',
      expectedTag: 'my-lib-1@v4.0.0-beta.1',
      expectedVersion: '4.0.0-beta.1',
      preId: 'beta',
    },
    {
      pattern: '{projectName}v{version}',
      projectName: 'my-lib-2',
      expectedTag: 'my-lib-2v4.0.0-beta.1',
      expectedVersion: '4.0.0-beta.1',
      preId: 'beta',
    },
    {
      pattern: '{projectName}{version}',
      projectName: 'my-lib-3',
      expectedTag: 'my-lib-34.0.0-beta.1',
      expectedVersion: '4.0.0-beta.1',
      preId: 'beta',
    },
    {
      pattern: '{version}-{projectName}',
      projectName: 'my-lib-1',
      expectedTag: '4.0.0-beta.0-my-lib-1',
      expectedVersion: '4.0.0-beta.0',
      preId: 'beta',
    },
    {
      pattern: '{version}-{projectName}',
      projectName: 'alpha',
      expectedTag: '3.0.0-beta.0-alpha',
      expectedVersion: '3.0.0-beta.0',
      preId: 'beta',
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
  ];

  describe('getLatestGitTagForPattern', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it.each(releaseTagPatternTestCases)(
      'should return tag $expectedTag for pattern $pattern',
      async ({ pattern, projectName, expectedTag, expectedVersion, preId }) => {
        const result = await getLatestGitTagForPattern(pattern, {
          projectName,
        }, {
          preId,
        });

        expect(result.tag).toEqual(expectedTag);
        expect(result.extractedVersion).toEqual(expectedVersion);
      }
    );

    it('should return null if execCommand throws an error', async () => {
      // should return null if execCommand throws an error
      (
        require('./exec-command').execCommand as jest.Mock
      ).mockImplementationOnce(() => {
        throw new Error('error');
      });
      const result = await getLatestGitTagForPattern('#{version}', {
        projectName: 'my-lib-1',
      });
      expect(result).toEqual(null);
    });

    it('should return null if no tags match the pattern', async () => {
      const result = await getLatestGitTagForPattern('#{version}', {
        projectName: 'my-lib-1',
      });

      expect(result).toEqual(null);
    });
  });

  describe('isStableSemver', () => {
    const versionTestCases = [
      {
        version: '0.0.0',
        expected: true,
      },
      {
        version: '1.0.0',
        expected: true,
      },
      {
        version: '1.0.0-beta.1',
        expected: false,
      },
      {
        version: '1.0.0+build.1',
        expected: false,
      },
      {
        version: '1.0.0-beta.1+build.1',
        expected: false,
      },
    ];

    it.each(versionTestCases)('should return $expected for version $version', ({ version, expected }) => {
      expect(isStableSemver(version)).toEqual(expected);
    });
  });
});
