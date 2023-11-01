import { getLatestGitTagForPattern } from './git';

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
`)
  ),
}));

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
  },
  {
    pattern: '{projectName}@v{version}',
    projectName: 'my-lib-1',
    expectedTag: 'my-lib-1@v4.0.0-beta.1',
    expectedVersion: '4.0.0-beta.1',
  },
  {
    pattern: '{projectName}v{version}',
    projectName: 'my-lib-2',
    expectedTag: 'my-lib-2v4.0.0-beta.1',
    expectedVersion: '4.0.0-beta.1',
  },
  {
    pattern: '{projectName}{version}',
    projectName: 'my-lib-3',
    expectedTag: 'my-lib-34.0.0-beta.1',
    expectedVersion: '4.0.0-beta.1',
  },
  {
    pattern: '{version}-{projectName}',
    projectName: 'my-lib-1',
    expectedTag: '4.0.0-beta.0-my-lib-1',
    expectedVersion: '4.0.0-beta.0',
  },
  {
    pattern: '{version}-{projectName}',
    projectName: 'alpha',
    expectedTag: '3.0.0-beta.0-alpha',
    expectedVersion: '3.0.0-beta.0',
  },
];

describe('getLatestGitTagForPattern', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each(releaseTagPatternTestCases)(
    'should return tag $expectedTag for pattern $pattern',
    async ({ pattern, projectName, expectedTag, expectedVersion }) => {
      const result = await getLatestGitTagForPattern(pattern, {
        projectName,
      });

      expect(result.tag).toEqual(expectedTag);
      expect(result.extractedVersion).toEqual(expectedVersion);
    }
  );

  it('should return null if execCommand throws an error', async () => {
    // should return null if execCommand throws an error
    (require('./exec-command').execCommand as jest.Mock).mockImplementationOnce(
      () => {
        throw new Error('error');
      }
    );
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
