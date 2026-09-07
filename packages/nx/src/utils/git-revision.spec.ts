import { assertValidGitRevision, assertValidGitSha } from './git-revision';

describe('assertValidGitSha', () => {
  it.each([
    'e83c5163316f89bfbde7d9ab23ca2e25604af290',
    'E83C5163316F89BFBDE7D9AB23CA2E25604AF290',
    '4a9d2b1',
  ])('should accept the commit sha %s', (sha) => {
    expect(() => assertValidGitSha(sha)).not.toThrow();
  });

  it.each([
    'HEAD; touch /tmp/pwned #',
    'HEAD',
    'main',
    '$(id)',
    'e83c516^',
    '',
    'abc',
  ])('should reject %s, which is not a commit sha', (sha) => {
    expect(() => assertValidGitSha(sha)).toThrow(/Invalid git commit sha/);
  });

  it('should name the invalid sha in the error message', () => {
    expect(() => assertValidGitSha('HEAD; id')).toThrow('HEAD; id');
  });
});

describe('assertValidGitRevision', () => {
  it.each([
    'main',
    'master',
    'origin/main',
    'HEAD',
    'HEAD~1',
    'HEAD^',
    'v1.2.3',
    'release/1.x',
    '4a9d2b1',
    'e83c5163316f89bfbde7d9ab23ca2e25604af290',
    'main@{u}',
    'HEAD@{2.days.ago}',
    '@{-1}',
    'feature/some-branch.name_with-chars',
  ])('should accept the valid revision %s', (revision) => {
    expect(() => assertValidGitRevision(revision)).not.toThrow();
  });

  it.each([
    '--upload-pack=touch /tmp/pwned',
    '--output=/tmp/pwned',
    '-c',
    '--exec=id',
  ])('should reject the option-like revision %s', (revision) => {
    expect(() => assertValidGitRevision(revision)).toThrow(
      /Invalid git revision/
    );
  });

  it('should name the invalid revision in the error message', () => {
    expect(() => assertValidGitRevision('--upload-pack=id')).toThrow(
      '--upload-pack=id'
    );
  });

  // Passing revisions as arguments rather than through a shell is what makes
  // these inert, so they do not need to be rejected.
  it.each([
    '$(touch /tmp/pwned)',
    'main; touch /tmp/pwned',
    '`id`',
    'main | id',
  ])('should accept the shell metacharacters in %s', (revision) => {
    expect(() => assertValidGitRevision(revision)).not.toThrow();
  });
});
