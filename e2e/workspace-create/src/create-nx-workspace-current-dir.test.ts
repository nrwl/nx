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
      `${pmc.createWorkspace} . --preset=apps --no-interactive --package-manager=${packageManager}`,
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

  it('scaffolds in place when the current directory is functionally empty', () => {
    // Mirror a freshly created GitHub repo: .git + README + LICENSE present.
    const dir = `${e2eCwd}/${uniq('cwd-funcempty')}`;
    mkdirSync(`${dir}/.git`, { recursive: true });
    writeFileSync(`${dir}/.git/config`, 'preexisting');
    writeFileSync(`${dir}/.gitignore`, 'node_modules\n');
    writeFileSync(`${dir}/README.md`, '# preexisting\n');
    writeFileSync(`${dir}/LICENSE`, 'MIT\n');
    try {
      createInCurrentDir(dir);

      expect(existsSync(`${dir}/nx.json`)).toBeTruthy();
      expect(existsSync(`${dir}/package.json`)).toBeTruthy();
      // The user's existing git repo is preserved.
      expect(existsSync(`${dir}/.git/config`)).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);

  it('errors when the current directory has real files', () => {
    const dir = `${e2eCwd}/${uniq('cwd-nonempty')}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.ts`, 'export {};\n');
    try {
      // execSync's thrown error.message only carries stderr; CNW prints the
      // failure to stdout, so assert on the captured stdout/stderr instead.
      let error: any;
      try {
        createInCurrentDir(dir);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(`${error.stdout ?? ''}${error.stderr ?? ''}`).toMatch(
        /not empty|nx init/
      );
      // The workspace must not have been scaffolded.
      expect(existsSync(`${dir}/nx.json`)).toBeFalsy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
