import {
  extractGitHubRepoSlug,
  extractGitLabRepoSlug,
} from './extract-repo-slug';

describe('extractGitHubRepoSlug', () => {
  describe('valid GitHub URLs', () => {
    it.each([
      ['https://github.com/user/repo.git', 'user/repo'],
      ['https://github.com/user/repo', 'user/repo'],
      ['git@github.com:user/repo.git', 'user/repo'],
      ['git@github.com:user/repo', 'user/repo'],
      ['ssh://git@github.com/user/repo.git', 'user/repo'],
      ['ssh://git@ssh.github.com:443/user/repo', 'user/repo'],
      ['https://user@github.com/user/repo.git', 'user/repo'],
      ['https://github.com/user/repo.git?ref=main', 'user/repo'],
      ['https://github.com/user/repo.git#readme', 'user/repo'],
    ])('parses %s → %s', (url, expected) => {
      expect(extractGitHubRepoSlug(url, 'github.com')).toBe(expected);
    });
  });

  describe('invalid/mismatched GitHub URLs', () => {
    it.each([
      ['https://gitlab.com/user/repo.git'],
      ['git@gitlab.com:user/repo.git'],
      ['not-a-url'],
      [''],
      ['https://github.com/user'], // only 1 segment
      ['https://github.com/'], // no segments
      ['https://github.com/.git'],
    ])('returns null for %s', (url) => {
      expect(extractGitHubRepoSlug(url, 'github.com')).toBeNull();
    });
  });
});

describe('extractGitLabRepoSlug', () => {
  describe('valid GitLab URLs with subgroups', () => {
    it.each([
      ['https://gitlab.com/user/repo.git', 'user/repo'],
      ['https://gitlab.com/user/repo', 'user/repo'],
      ['https://gitlab.com/group/subgroup/repo.git', 'group/subgroup/repo'],
      ['https://gitlab.com/group/subgroup/repo', 'group/subgroup/repo'],
      ['git@gitlab.com:group/subgroup/repo.git', 'group/subgroup/repo'],
      ['git@gitlab.com:group/subgroup/repo', 'group/subgroup/repo'],
      ['ssh://git@gitlab.com/group/subgroup/repo.git', 'group/subgroup/repo'],
      [
        'ssh://git@gitlab.com:22/group/subgroup/repo.git',
        'group/subgroup/repo',
      ],
      [
        'https://user@gitlab.com/group/subgroup/repo.git',
        'group/subgroup/repo',
      ],
      [
        'https://gitlab.com/group/subgroup/repo.git?ref=main',
        'group/subgroup/repo',
      ],
      [
        'https://gitlab.com/group/subgroup/repo.git#readme',
        'group/subgroup/repo',
      ],
    ])('parses %s → %s', (url, expected) => {
      expect(extractGitLabRepoSlug(url, 'gitlab.com')).toBe(expected);
    });

    it('supports deeply nested slugs', () => {
      const url = 'https://gitlab.com/org/team/subteam/subproject/project.git';
      expect(extractGitLabRepoSlug(url, 'gitlab.com')).toBe(
        'org/team/subteam/subproject/project'
      );
    });
  });

  describe('invalid/mismatched GitLab URLs', () => {
    it.each([
      ['https://github.com/user/repo.git'],
      ['git@github.com:user/repo.git'],
      ['not-a-url'],
      [''],
      ['https://gitlab.com/user'],
      ['https://gitlab.com/'],
      ['https://gitlab.com/.git'],
    ])('returns null for %s', (url) => {
      expect(extractGitLabRepoSlug(url, 'gitlab.com')).toBeNull();
    });
  });

  describe('self-hosted GitLab', () => {
    it.each([
      ['https://gitlab.company.com/group/repo.git', 'group/repo'],
      ['git@gitlab.company.com:group/repo.git', 'group/repo'],
      ['ssh://git@gitlab.company.com/group/repo.git', 'group/repo'],
    ])('extracts valid repo from %s', (url, expected) => {
      expect(extractGitLabRepoSlug(url, 'gitlab.company.com')).toBe(expected);
    });

    it('returns null on host mismatch', () => {
      const url = 'https://gitlab.company-a.com/group/repo.git';
      expect(extractGitLabRepoSlug(url, 'gitlab.company-b.com')).toBeNull();
    });
  });
});
