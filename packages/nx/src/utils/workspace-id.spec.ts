import { execSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { computeRepoKey, deriveRepoKey } from './workspace-id';

describe('computeRepoKey', () => {
  it('should hash identity and relative path together', () => {
    expect(computeRepoKey('github.com/nrwl/nx', '')).toEqual(
      computeRepoKey('github.com/nrwl/nx', '')
    );
    expect(computeRepoKey('github.com/nrwl/nx', '')).not.toEqual(
      computeRepoKey('github.com/nrwl/nx', 'packages/app')
    );
    expect(computeRepoKey('github.com/nrwl/nx', 'a')).not.toEqual(
      computeRepoKey('github.com/other/repo', 'a')
    );
  });

  it('should produce a 64-char hex sha256', () => {
    expect(computeRepoKey('github.com/nrwl/nx', '')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('deriveRepoKey', () => {
  let repo: string;

  const git = (cmd: string, cwd: string = repo) =>
    execSync(`git ${cmd}`, { cwd, stdio: 'pipe' }).toString().trim();

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'nx-repo-key-'));
    git('init');
    git('config user.email test@test.com');
    git('config user.name Test');
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('should key on the normalized remote regardless of protocol', () => {
    git('remote add origin git@github.com:nrwl/nx.git');
    const sshKey = deriveRepoKey(repo);

    git('remote set-url origin https://github.com/nrwl/nx.git');
    const httpsKey = deriveRepoKey(repo);

    git('remote set-url origin https://token@github.com/nrwl/nx.git');
    const tokenKey = deriveRepoKey(repo);

    expect(sshKey).toEqual(computeRepoKey('github.com/nrwl/nx', ''));
    expect(httpsKey).toEqual(sshKey);
    expect(tokenKey).toEqual(sshKey);
  });

  it('should normalize remote casing and trailing slashes', () => {
    git('remote add origin git@GitHub.com:NRWL/Nx.git');
    expect(deriveRepoKey(repo)).toEqual(
      computeRepoKey('github.com/nrwl/nx', '')
    );

    git('remote set-url origin https://github.com/nrwl/nx/');
    expect(deriveRepoKey(repo)).toEqual(
      computeRepoKey('github.com/nrwl/nx', '')
    );
  });

  it('should include the workspace path relative to the git root', () => {
    git('remote add origin git@github.com:nrwl/nx.git');
    const nested = join(repo, 'apps', 'inner');
    mkdirSync(nested, { recursive: true });

    expect(deriveRepoKey(nested)).toEqual(
      computeRepoKey('github.com/nrwl/nx', 'apps/inner')
    );
    expect(deriveRepoKey(nested)).not.toEqual(deriveRepoKey(repo));
  });

  it('should fall back to the first-commit SHA when there is no remote', () => {
    writeFileSync(join(repo, 'f'), '');
    git('add .');
    git('commit -m first');
    git('commit --allow-empty -m second');
    const firstSha = git('rev-list --max-parents=0 HEAD');

    expect(deriveRepoKey(repo)).toEqual(computeRepoKey(firstSha, ''));
  });

  it('should return null when there is no remote and no commits', () => {
    expect(deriveRepoKey(repo)).toBeNull();
  });

  it('should return null outside a git repository', () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'nx-not-a-repo-'));
    try {
      expect(deriveRepoKey(notARepo)).toBeNull();
    } finally {
      rmSync(notARepo, { recursive: true, force: true });
    }
  });
});
