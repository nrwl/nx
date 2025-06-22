// Mock `execSync` to intercept calls to `git remote get-url` command
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

import { execSync } from 'node:child_process';
import { GithubRemoteReleaseClient } from './github';
import { RemoteRepoSlug } from './remote-release-client';
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

// Helper to generate expected result for default GitHub host
const expectedDefaultResult = (slug: string) => ({
  hostname: 'github.com',
  apiBaseUrl: 'https://api.github.com',
  slug,
});

describe('GithubRemoteReleaseClient.resolveRepoData', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  describe('Custom provider configuration', () => {
    it('should handle GitHub Enterprise Server with custom hostname and API base', () => {
      mockExecSync.mockReturnValue(
        'https://github.mycompany.com/username/repo.git'
      );

      const result = GithubRemoteReleaseClient.resolveRepoData({
        provider: 'github',
        hostname: 'github.mycompany.com',
        apiBaseUrl: 'https://github.mycompany.com/api/v3',
      });

      expect(result).toEqual({
        hostname: 'github.mycompany.com',
        apiBaseUrl: 'https://github.mycompany.com/api/v3',
        slug: 'username/repo',
      });
    });
  });

  describe('Remote name support', () => {
    it('should use specified remote name', () => {
      mockExecSync.mockReturnValue('https://github.com/upstream-user/repo.git');

      GithubRemoteReleaseClient.resolveRepoData(false, 'upstream');

      expect(mockExecSync).toHaveBeenCalledWith('git remote get-url upstream', {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    });
  });

  describe('GitHub user/repo parsing', () => {
    const usernameRepoSlug: RemoteRepoSlug = 'username/repo';

    interface ExtractionCase {
      label: string;
      url: string | (() => string);
      expected?: RemoteRepoSlug | null;
    }

    const userRepoExtractionSuccessCases: ExtractionCase[] = [
      {
        label: 'HTTPS URL with .git suffix',
        url: 'https://github.com/username/repo.git',
        expected: usernameRepoSlug,
      },
      {
        label: 'HTTPS URL without .git suffix',
        url: 'https://github.com/username/repo',
        expected: usernameRepoSlug,
      },
      {
        label: 'HTTPS URL with trailing slash',
        url: 'https://github.com/username/repo/',
        expected: usernameRepoSlug,
      },
      {
        label: 'HTTPS URL with basic auth',
        url: 'https://user:token@github.com/username/repo.git',
        expected: usernameRepoSlug,
      },
      {
        label: 'HTTP URL with .git suffix',
        url: 'http://github.com/username/repo.git',
        expected: usernameRepoSlug,
      },
      {
        label: 'shorthand SSH URL with .git suffix',
        url: 'git@github.com:username/repo.git',
        expected: usernameRepoSlug,
      },
      {
        label: 'shorthand SSH URL without .git suffix',
        url: 'git@github.com:username/repo',
        expected: usernameRepoSlug,
      },
      {
        label: 'shorthand SSH URL using ssh subdomain',
        url: 'git@ssh.github.com:username/repo.git',
        expected: usernameRepoSlug,
      },
      {
        label: 'fully qualified SSH URL with port and .git suffix',
        url: 'ssh://git@ssh.github.com:443/username/repo.git',
        expected: usernameRepoSlug,
      },
      {
        label: 'fully qualified SSH URL without .git suffix',
        url: 'ssh://git@github.com/username/repo',
        expected: usernameRepoSlug,
      },
      {
        label: 'fully qualified SSH URL with trailing slash',
        url: 'ssh://git@github.com/username/repo/',
        expected: usernameRepoSlug,
      },
      {
        label: 'HTTPS URL with dashed and dotted slug',
        url: 'https://github.com/user-name/repo-name.test.git',
        expected: 'user-name/repo-name.test',
      },
      {
        label: 'HTTPS URL with kebab-case slug',
        url: 'https://github.com/my-org/my-project.git',
        expected: 'my-org/my-project',
      },
      {
        label: 'HTTPS URL with snake_case slug',
        url: 'https://github.com/my_org/my_project.git',
        expected: 'my_org/my_project',
      },
      {
        label: 'HTTPS URL with mixed-case slug',
        url: 'https://github.com/my-org/my_project.git',
        expected: 'my-org/my_project',
      },
    ];

    userRepoExtractionSuccessCases.forEach(({ label, url, expected }) => {
      it(`should extract the user/repo part from ${label}`, () => {
        mockExecSync.mockReturnValue(url as string);
        expect(GithubRemoteReleaseClient.resolveRepoData(false)).toEqual(
          expectedDefaultResult(expected)
        );
      });
    });

    const userRepoExtractionFailureCases: ExtractionCase[] = [
      {
        label: 'git command fails',
        url: () => {
          throw new Error('fatal: No such remote');
        },
      },
      {
        label: 'the URL is invalid',
        url: () => 'not-a-valid-url',
      },
      {
        label: 'the URL is not a GitHub URL',
        url: () => 'https://gitlab.com/username/repo.git',
      },
      {
        label: 'the URL is missing repo',
        url: () => 'https://github.com/',
      },
      {
        label: 'the URL is missing owner/repo',
        url: () => 'https://github.com/username',
      },
    ];

    userRepoExtractionFailureCases.forEach(({ label, url }) => {
      it(`should return null when ${label}`, () => {
        mockExecSync.mockImplementation(url as never);
        expect(GithubRemoteReleaseClient.resolveRepoData(false)).toBeNull();
      });
    });
  });

  describe('Edge cases', () => {
    it('should trim surrounding whitespace', () => {
      mockExecSync.mockReturnValue('  https://github.com/username/repo.git  ');
      expect(GithubRemoteReleaseClient.resolveRepoData(false)).toEqual(
        expectedDefaultResult('username/repo')
      );
    });

    it('should fail on mixed case domain (should be case-sensitive)', () => {
      mockExecSync.mockReturnValue('https://GitHub.com/username/repo.git');
      expect(GithubRemoteReleaseClient.resolveRepoData(false)).toBeNull();
    });

    it('should handle repo name ending in .git (literal)', () => {
      mockExecSync.mockReturnValue('https://github.com/username/repo.git.git');
      expect(GithubRemoteReleaseClient.resolveRepoData(false)).toEqual(
        expectedDefaultResult('username/repo.git')
      );
    });
  });
});
