import {
  e2eCwd,
  getPackageManagerCommand,
  getSelectedPackageManager,
  getStrippedEnvironmentVariables,
  uniq,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs-extra';

describe('create-nx-workspace current directory', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  // create-nx-workspace . scaffolds into the current directory in place rather
  // than into a new subfolder. Run non-interactively (CI), like an AI agent.
  function createInCurrentDir(dir: string): string {
    const pmc = getPackageManagerCommand({ packageManager });
    return execSync(
      `${pmc.createWorkspace} . --template=empty --no-interactive --package-manager=${packageManager}`,
      {
        cwd: dir,
        stdio: 'pipe',
        env: { CI: 'true', ...getStrippedEnvironmentVariables() },
        encoding: 'utf-8',
      }
    );
  }

  it('scaffolds in place when the current directory is empty', () => {
    const dir = `${e2eCwd}/${uniq('cwd-empty')}`;
    mkdirSync(dir, { recursive: true });
    try {
      createInCurrentDir(dir);

      expect(existsSync(`${dir}/nx.json`)).toBeTruthy();
      expect(existsSync(`${dir}/package.json`)).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  it('scaffolds in place in an existing git repo and preserves it', () => {
    // Mirror a freshly created GitHub repo: a real git repo with a remote +
    // README + LICENSE.
    const dir = `${e2eCwd}/${uniq('cwd-gitrepo')}`;
    mkdirSync(dir, { recursive: true });
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git remote add origin https://example.com/my-repo.git', {
      cwd: dir,
      stdio: 'pipe',
    });
    writeFileSync(`${dir}/.gitignore`, 'node_modules\n');
    writeFileSync(`${dir}/README.md`, '# preexisting\n');
    writeFileSync(`${dir}/LICENSE`, 'MIT\n');
    try {
      createInCurrentDir(dir);

      expect(existsSync(`${dir}/nx.json`)).toBeTruthy();
      expect(existsSync(`${dir}/package.json`)).toBeTruthy();
      // The user's existing git repo (and its remote) must survive - CNW
      // detects the repo and skips git initialization.
      const remote = execSync('git remote get-url origin', {
        cwd: dir,
        encoding: 'utf-8',
      }).trim();
      expect(remote).toBe('https://example.com/my-repo.git');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  it('scaffolds in place without deleting unrelated pre-existing files', () => {
    const dir = `${e2eCwd}/${uniq('cwd-nonempty')}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/keep-me.txt`, 'keep\n');
    try {
      createInCurrentDir(dir);

      expect(existsSync(`${dir}/nx.json`)).toBeTruthy();
      // Files not part of the template are left untouched.
      expect(existsSync(`${dir}/keep-me.txt`)).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
