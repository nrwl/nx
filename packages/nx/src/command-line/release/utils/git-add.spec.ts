import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitAdd } from './git';

describe('gitAdd', () => {
  let gitRoot: string;
  let workspaceRoot: string;

  const git = (cmd: string, cwd = gitRoot) =>
    execSync(`git ${cmd}`, { cwd, encoding: 'utf-8' });

  beforeEach(() => {
    gitRoot = mkdtempSync(join(tmpdir(), 'nx-release-git-add-'));
    workspaceRoot = join(gitRoot, 'workspace');
    mkdirSync(join(workspaceRoot, '.nx', 'version-plans'), { recursive: true });
    writeFileSync(join(workspaceRoot, 'CHANGELOG.md'), '');
    writeFileSync(join(workspaceRoot, '.nx', 'version-plans', 'a.md'), 'a');
    writeFileSync(join(workspaceRoot, '.nx', 'version-plans', 'b.md'), 'b');
    git('init -q');
    git('config user.email test@example.com');
    git('config user.name test');
    git('add -A');
    git('commit -q -m init');
  });

  afterEach(() => {
    rmSync(gitRoot, { recursive: true, force: true });
  });

  it('should stage deleted files given as platform paths relative to a workspace below the git root', async () => {
    const plan = join('.nx', 'version-plans', 'a.md');
    rmSync(join(workspaceRoot, plan));

    await gitAdd({
      deletedFiles: [plan],
      cwd: workspaceRoot,
      logFn: () => {},
    });

    expect(git('status --porcelain')).toEqual(
      'D  workspace/.nx/version-plans/a.md\n'
    );
  });

  it('should skip deleted files that are already staged', async () => {
    const staged = join('.nx', 'version-plans', 'a.md');
    const unstaged = join('.nx', 'version-plans', 'b.md');
    git(`rm -q ${staged.replace(/\\/g, '/')}`, workspaceRoot);
    rmSync(join(workspaceRoot, unstaged));

    await gitAdd({
      deletedFiles: [staged, unstaged],
      cwd: workspaceRoot,
      logFn: () => {},
    });

    expect(git('status --porcelain')).toEqual(
      'D  workspace/.nx/version-plans/a.md\nD  workspace/.nx/version-plans/b.md\n'
    );
  });
});
