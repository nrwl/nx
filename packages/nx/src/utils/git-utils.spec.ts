import { extractUserAndRepoFromGitHubUrl } from './git-utils';

describe('extractUserAndRepoFromGitHubUrl', () => {
  it('should return the github user + repo info for origin', () => {
    expect(
      extractUserAndRepoFromGitHubUrl(
        `
          upstream	git@github.com:upstream-user/repo-name.git (fetch)
          upstream	git@github.com:upstream-user/repo-name.git (push)
          origin	git@github.com:origin-user/repo-name.git (fetch)
          origin	git@github.com:origin-user/repo-name.git (push)
        `
      )
    ).toBe('origin-user/repo-name');
  });

  it('should return the github user + repo info for the first one since no origin', () => {
    expect(
      extractUserAndRepoFromGitHubUrl(
        `
          upstream	git@github.com:upstream-user/repo-name.git (fetch)
          upstream	git@github.com:upstream-user/repo-name.git (push)
          other	git@github.com:other-user/repo-name.git (fetch)
          other	git@github.com:other-user/repo-name.git (push)
        `
      )
    ).toBe('upstream-user/repo-name');
  });

  it('should return null since no github', () => {
    expect(
      extractUserAndRepoFromGitHubUrl(
        `
          upstream	git@random.com:upstream-user/repo-name.git (fetch)
          upstream	git@random.com:upstream-user/repo-name.git (push)
          origin	git@random.com:other-user/repo-name.git (fetch)
          origin	git@random.com:other-user/repo-name.git (push)
        `
      )
    ).toBe(null);
  });
});
