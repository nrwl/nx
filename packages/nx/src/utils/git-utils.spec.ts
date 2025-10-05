import { parseVcsRemoteUrl, getVcsRemoteInfo } from './git-utils';
import { execSync } from 'child_process';

jest.mock('child_process');

describe('git utils tests', () => {
  describe('parseVcsRemoteUrl', () => {
    it('should parse GitHub SSH URLs', () => {
      expect(parseVcsRemoteUrl('git@github.com:nrwl/nx.git')).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should parse GitHub SSH URLs with period (ssh)', () => {
      expect(parseVcsRemoteUrl('git@github.com:nrwl.abc/nx.abc.git')).toEqual({
        domain: 'github.com',
        slug: 'nrwl.abc/nx.abc',
      });
    });

    it('should parse GitHub HTTPS URLs', () => {
      expect(parseVcsRemoteUrl('https://github.com/nrwl/nx.git')).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should parse GitHub SSH URLs with period (https)', () => {
      expect(
        parseVcsRemoteUrl('https://github.com/nrwl.abc/nx.abc.git')
      ).toEqual({
        domain: 'github.com',
        slug: 'nrwl.abc/nx.abc',
      });
    });

    it('should parse GitHub Enterprise SSH URLs', () => {
      expect(
        parseVcsRemoteUrl('git@github.enterprise.com:org/repo.git')
      ).toEqual({
        domain: 'github.enterprise.com',
        slug: 'org/repo',
      });
    });

    it('custom domains ssh', () => {
      expect(parseVcsRemoteUrl('git@enterprise.com:org/repo.git')).toEqual({
        domain: 'enterprise.com',
        slug: 'org/repo',
      });
    });

    it('should parse GitHub Enterprise HTTPS URLs', () => {
      expect(
        parseVcsRemoteUrl('https://github.enterprise.com/org/repo.git')
      ).toEqual({
        domain: 'github.enterprise.com',
        slug: 'org/repo',
      });
    });

    it('custom domains', () => {
      expect(parseVcsRemoteUrl('https://enterprise.com/org/repo.git')).toEqual({
        domain: 'enterprise.com',
        slug: 'org/repo',
      });
    });

    it('should parse GitLab SSH URLs', () => {
      expect(
        parseVcsRemoteUrl('git@gitlab.com:group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should parse GitLab HTTPS URLs', () => {
      expect(parseVcsRemoteUrl('https://gitlab.com/group/project.git')).toEqual(
        {
          domain: 'gitlab.com',
          slug: 'group/project',
        }
      );
    });

    it('should parse Bitbucket SSH URLs', () => {
      expect(parseVcsRemoteUrl('git@bitbucket.org:team/repo.git')).toEqual({
        domain: 'bitbucket.org',
        slug: 'team/repo',
      });
    });

    it('should parse Bitbucket HTTPS URLs', () => {
      expect(parseVcsRemoteUrl('https://bitbucket.org/team/repo.git')).toEqual({
        domain: 'bitbucket.org',
        slug: 'team/repo',
      });
    });

    it('should parse HTTPS URLs with authentication', () => {
      expect(
        parseVcsRemoteUrl('https://user@gitlab.com/group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should parse SSH URLs with alternative format', () => {
      expect(
        parseVcsRemoteUrl('ssh://git@gitlab.com/group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should parse SSH URLs with port', () => {
      expect(
        parseVcsRemoteUrl('ssh://git@gitlab.com:2222/group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should handle URLs without .git extension', () => {
      expect(parseVcsRemoteUrl('git@github.com:nrwl.abc/nx.abc')).toEqual({
        domain: 'github.com',
        slug: 'nrwl.abc/nx.abc',
      });
    });

    it('should return null for invalid URLs', () => {
      expect(parseVcsRemoteUrl('not-a-valid-url')).toBeNull();
      expect(parseVcsRemoteUrl('')).toBeNull();
      expect(parseVcsRemoteUrl('https://example.com')).toBeNull();
    });
  });

  describe('getVcsRemoteInfo', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return VCS info for GitHub remote', () => {
      (execSync as jest.Mock).mockReturnValue(`
        origin	git@github.com:nrwl/nx.git (fetch)
        origin	git@github.com:nrwl/nx.git (push)
      `);

      expect(getVcsRemoteInfo()).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should return VCS info for GitLab remote', () => {
      (execSync as jest.Mock).mockReturnValue(`
        origin	git@gitlab.com:group/project.git (fetch)
        origin	git@gitlab.com:group/project.git (push)
      `);

      expect(getVcsRemoteInfo()).toEqual({
        domain: 'gitlab.com',
        slug: 'group/project',
      });
    });

    it('should prioritize origin over other remotes', () => {
      (execSync as jest.Mock).mockReturnValue(`
        upstream	git@gitlab.com:other/project.git (fetch)
        upstream	git@gitlab.com:other/project.git (push)
        origin	git@github.com:nrwl/nx.git (fetch)
        origin	git@github.com:nrwl/nx.git (push)
      `);

      expect(getVcsRemoteInfo()).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should return null when no remotes exist', () => {
      (execSync as jest.Mock).mockReturnValue('');

      expect(getVcsRemoteInfo()).toBeNull();
    });

    it('should return null when execSync throws', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('git not found');
      });

      expect(getVcsRemoteInfo()).toBeNull();
    });
  });
});
