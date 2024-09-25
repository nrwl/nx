import {
  extractUserAndRepoFromGitHubUrl,
  getGithubSlugOrNull,
} from './git-utils';
import { execSync } from 'child_process';

jest.mock('child_process');

describe('git utils tests', () => {
  describe('getGithubSlugOrNull', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return the github slug from the remote URL', () => {
      (execSync as jest.Mock).mockReturnValue(`
      origin	git@github.com:origin-user/repo-name.git (fetch)
      origin	git@github.com:origin-user/repo-name.git (push)
    `);

      const result = getGithubSlugOrNull();

      expect(result).toBe('origin-user/repo-name');
      expect(execSync).toHaveBeenCalledWith('git remote -v', {
        stdio: 'pipe',
        windowsHide: true,
      });
    });

    it('should return "github" if there are no remotes', () => {
      (execSync as jest.Mock).mockReturnValue('');

      const result = getGithubSlugOrNull();

      expect(result).toBe('github');
      expect(execSync).toHaveBeenCalledWith('git remote -v', {
        stdio: 'pipe',
        windowsHide: true,
      });
    });

    it('should return "github" if execSync throws an error', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('error');
      });

      const result = getGithubSlugOrNull();

      expect(result).toBe('github');
      expect(execSync).toHaveBeenCalledWith('git remote -v', {
        stdio: 'pipe',
        windowsHide: true,
      });
    });

    it('should return the first github remote slug if no origin is present', () => {
      (execSync as jest.Mock).mockReturnValue(`
      upstream	git@github.com:upstream-user/repo-name.git (fetch)
      upstream	git@github.com:upstream-user/repo-name.git (push)
    `);

      const result = getGithubSlugOrNull();

      expect(result).toBe('upstream-user/repo-name');
      expect(execSync).toHaveBeenCalledWith('git remote -v', {
        stdio: 'pipe',
        windowsHide: true,
      });
    });

    it('should return null if remote is set up but not github', () => {
      (execSync as jest.Mock).mockReturnValue(`
      upstream	git@gitlab.com:upstream-user/repo-name.git (fetch)
      upstream	git@gitlab.com:upstream-user/repo-name.git (push)
    `);

      const result = getGithubSlugOrNull();

      expect(result).toBeNull();
      expect(execSync).toHaveBeenCalledWith('git remote -v', {
        stdio: 'pipe',
        windowsHide: true,
      });
    });

    it('should return the first github remote slug for HTTPS URLs', () => {
      (execSync as jest.Mock).mockReturnValue(`
      origin	https://github.com/origin-user/repo-name.git (fetch)
      origin	https://github.com/origin-user/repo-name.git (push)
    `);

      const result = getGithubSlugOrNull();

      expect(result).toBe('origin-user/repo-name');
      expect(execSync).toHaveBeenCalledWith('git remote -v', {
        stdio: 'pipe',
        windowsHide: true,
      });
    });
  });

  describe('extractUserAndRepoFromGitHubUrl', () => {
    describe('ssh cases', () => {
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

      it('should return the github user + repo info for upstream since no origin', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	git@github.com:upstream-user/repo-name.git (fetch)
          upstream	git@github.com:upstream-user/repo-name.git (push)
          base	git@github.com:base-user/repo-name.git (fetch)
          base	git@github.com:base-user/repo-name.git (push)
          other	git@github.com:other-user/repo-name.git (fetch)
          other	git@github.com:other-user/repo-name.git (push)
        `
          )
        ).toBe('upstream-user/repo-name');
      });

      it('should return the github user + repo info for base since no origin and upstream', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          base	git@github.com:base-user/repo-name.git (fetch)
          base	git@github.com:base-user/repo-name.git (push)
          other	git@github.com:other-user/repo-name.git (fetch)
          other	git@github.com:other-user/repo-name.git (push)
        `
          )
        ).toBe('base-user/repo-name');
      });

      it('should return the github user + repo info for the first one since no origin, upstream, or base', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          other	git@github.com:other-user/repo-name.git (fetch)
          other	git@github.com:other-user/repo-name.git (push)
          another	git@github.com:another-user/repo-name.git (fetch)
          another	git@github.com:another-user/repo-name.git (push)
        `
          )
        ).toBe('other-user/repo-name');
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

    describe('https cases', () => {
      it('should return the github user + repo info for origin', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	https://github.com/upstream-user/repo-name.git (fetch)
          upstream	https://github.com/upstream-user/repo-name.git (push)
          origin	https://github.com/origin-user/repo-name.git (fetch)
          origin	https://github.com/origin-user/repo-name.git (push)
        `
          )
        ).toBe('origin-user/repo-name');
      });

      it('should return the github user + repo info for upstream since no origin', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	https://github.com/upstream-user/repo-name.git (fetch)
          upstream	https://github.com/upstream-user/repo-name.git (push)
          base	https://github.com/base-user/repo-name.git (fetch)
          base	https://github.com/base-user/repo-name.git (push)
          other	https://github.com/other-user/repo-name.git (fetch)
          other	https://github.com/other-user/repo-name.git (push)
        `
          )
        ).toBe('upstream-user/repo-name');
      });

      it('should return the github user + repo info for base since no origin and upstream', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          base	https://github.com/base-user/repo-name.git (fetch)
          base	https://github.com/base-user/repo-name.git (push)
          other	https://github.com/other-user/repo-name.git (fetch)
          other	https://github.com/other-user/repo-name.git (push)
        `
          )
        ).toBe('base-user/repo-name');
      });

      it('should return the github user + repo info for the first one since no origin, upstream, or base', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          other	https://github.com/other-user/repo-name.git (fetch)
          other	https://github.com/other-user/repo-name.git (push)
          another	https://github.com/another-user/repo-name.git (fetch)
          another	https://github.com/another-user/repo-name.git (push)
        `
          )
        ).toBe('other-user/repo-name');
      });

      it('should return null since no github', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	https://other.com/upstream-user/repo-name.git (fetch)
          upstream	https://other.com/upstream-user/repo-name.git (push)
          origin	https://other.com/other-user/repo-name.git (fetch)
          origin	https://other.com/other-user/repo-name.git (push)
        `
          )
        ).toBe(null);
      });
    });
  });
});
