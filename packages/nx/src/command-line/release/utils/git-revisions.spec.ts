import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveChangelogFromSHA } from '../changelog/version-plan-filtering';
import { getCommitHash, getGitDiff } from './git';
import { RepoGitTags } from './repository-git-tags';

const repo = vi.hoisted(() => ({ root: '' }));

vi.mock('../../../utils/workspace-root', () => ({
  get workspaceRoot() {
    return repo.root;
  },
}));

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo.root, encoding: 'utf-8' });
}

describe('release git revisions', () => {
  const originalCwd = process.cwd();
  let headSha: string;

  beforeEach(() => {
    repo.root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-release-git-')));
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'tag.gpgsign', 'false');
    writeFileSync(join(repo.root, 'file.txt'), 'a');
    git('add', '.');
    git('commit', '-q', '-m', 'feat: initial');
    headSha = git('rev-parse', 'HEAD').trim();
    process.chdir(repo.root);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(repo.root, { recursive: true, force: true });
  });

  it('should reject a flag-shaped ref instead of echoing it back as a sha', async () => {
    await expect(getCommitHash('--output=out.txt')).rejects.toThrow(
      'Git revisions cannot start with "-"'
    );
  });

  it('should fail for a ref git cannot resolve', async () => {
    await expect(getCommitHash('does-not-exist')).rejects.toThrow(
      'Unknown revision: does-not-exist'
    );
  });

  it.each([
    ['--output=victim.txt', '--output=victim.txt'],
    ['--output=victim.txt', 'HEAD'],
    [undefined, '--output=victim.txt'],
  ])(
    'should not pass a flag-shaped range to git log (from: %s, to: %s)',
    async (from, to) => {
      writeFileSync(join(repo.root, 'victim.txt'), 'original');

      await expect(getGitDiff(from, to)).rejects.toThrow(
        'Git revisions cannot start with "-"'
      );

      expect(readFileSync(join(repo.root, 'victim.txt'), 'utf-8')).toBe(
        'original'
      );
      expect(readdirSync(repo.root).sort()).toEqual([
        '.git',
        'file.txt',
        'victim.txt',
      ]);
    }
  );

  it('should resolve a matched tag whose name starts with "-" as a tag', async () => {
    const tag = '--output=out@9.0.0-beta.1';
    git('update-ref', `refs/tags/${tag}`, 'HEAD');

    const fromSHA = await resolveChangelogFromSHA({
      tagPattern: '{projectName}@{version}',
      tagPatternValues: {},
      checkAllBranchesWhen: undefined,
      preid: 'beta',
      requireSemver: true,
      strictPreid: false,
      useAutomaticFromRef: false,
      resolveRepositoryTags: (when) => RepoGitTags.create().resolveTags(when),
    });

    expect(fromSHA).toBe(headSha);
    expect(existsSync(join(repo.root, `out@9.0.0-beta.1..${headSha}`))).toBe(
      false
    );
  });

  it('should read commits after a qualified tag whose name starts with "-"', async () => {
    const tag = '--output=out@9.0.0-beta.1';
    git('update-ref', `refs/tags/${tag}`, 'HEAD');
    writeFileSync(join(repo.root, 'file.txt'), 'b');
    git('commit', '-q', '-am', 'fix: second');

    const commits = await getGitDiff(`refs/tags/${tag}`);

    expect(commits.map((c) => c.message)).toEqual(['fix: second']);
    expect(readdirSync(repo.root).sort()).toEqual(['.git', 'file.txt']);
  });
});
