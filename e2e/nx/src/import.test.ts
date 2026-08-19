import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  e2eCwd,
  readJson,
  readFile,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { mkdirSync, rmSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'path';
import { createMultiPackageRepo, createSimpleRepo } from './import-utils';

describe('Nx Import', () => {
  let proj: string;
  const tempImportE2ERoot = join(e2eCwd, 'nx-import');
  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/js'],
    });

    if (getSelectedPackageManager() === 'pnpm') {
      updateFile(
        'pnpm-workspace.yaml',
        `packages:
  - 'projects/*'
`
      );
    } else {
      updateJson('package.json', (json) => {
        json.workspaces = ['projects/*'];
        return json;
      });
    }

    try {
      rmSync(join(tempImportE2ERoot), { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    // Clean up the temp import directory before each test to not have any uncommited changes
    runCommand(`git add .`);
    runCommand(`git commit -am "Update" --allow-empty`);
  });

  afterAll(() => cleanupProject());

  it('should be able to import a vite app', () => {
    mkdirSync(join(tempImportE2ERoot), { recursive: true });
    const tempViteProjectName = 'created-vite-app';
    execSync(
      `npx create-vite@latest ${tempViteProjectName} --template react-ts`,
      {
        cwd: tempImportE2ERoot,
      }
    );
    const tempViteProjectPath = join(tempImportE2ERoot, tempViteProjectName);
    execSync(`git init`, {
      cwd: tempViteProjectPath,
    });
    execSync(`git add .`, {
      cwd: tempViteProjectPath,
    });
    execSync(`git commit -am "initial commit"`, {
      cwd: tempViteProjectPath,
    });

    try {
      execSync(`git checkout -b main`, {
        cwd: tempViteProjectPath,
      });
    } catch {
      // This fails if git is already configured to have `main` branch, but that's OK
    }

    const remote = tempViteProjectPath;
    const ref = 'main';
    const source = '.';
    const directory = 'projects/vite-app';

    runCLI(
      `import ${remote} ${directory} --ref ${ref} --source ${source} --no-interactive`,
      {
        verbose: true,
      }
    );

    checkFilesExist(
      'projects/vite-app/.gitignore',
      'projects/vite-app/package.json',
      'projects/vite-app/index.html',
      'projects/vite-app/vite.config.ts',
      'projects/vite-app/src/main.tsx',
      'projects/vite-app/src/App.tsx'
    );
    runCLI(`vite:build created-vite-app`);
  });

  it('should be able to import two directories from same repo', () => {
    const repoPath = createMultiPackageRepo(tempImportE2ERoot);

    runCLI(
      `import ${repoPath} packages/a --ref main --source packages/a --no-interactive`,
      {
        verbose: true,
      }
    );
    runCLI(
      `import ${repoPath} packages/b --ref main --source packages/b --no-interactive`,
      {
        verbose: true,
      }
    );

    if (getSelectedPackageManager() === 'pnpm') {
      const workspaceYaml = readFile('pnpm-workspace.yaml');
      expect(workspaceYaml).toMatch(/(packages\/a)/);
      expect(workspaceYaml).toMatch(/(packages\/b)/);
    } else {
      const packageJson = readJson('package.json');
      expect(packageJson.workspaces).toContain('packages/a');
      expect(packageJson.workspaces).toContain('packages/b');
    }

    checkFilesExist('packages/a/README.md', 'packages/b/README.md');
  });

  // The workspaces entry `nx import` adds is written after the merge commit, so
  // it only reaches the user's history through the amend. Importing OUTSIDE the
  // fixture's `projects/*` globs is what makes that branch run at all - inside
  // them `isPkgIncluded` is true and it returns before writing anything.
  //
  // `--source .` is required: `--no-interactive` does not suppress that prompt,
  // which only defaults under `isAiAgent()`.
  it('should commit the workspaces entry it adds', () => {
    mkdirSync(tempImportE2ERoot, { recursive: true });
    const repoPath = createSimpleRepo(tempImportE2ERoot, 'workspaces-src');

    runCLI(
      `import ${repoPath} imported/pkg --ref main --source . --no-interactive`,
      { verbose: true }
    );

    // pnpm keeps its workspaces in pnpm-workspace.yaml; everyone else in
    // package.json.
    const workspacesFile =
      getSelectedPackageManager() === 'pnpm'
        ? 'pnpm-workspace.yaml'
        : 'package.json';
    expect(readFile(workspacesFile)).toContain('imported/pkg');

    // Amended, not left dirty for the user to commit themselves.
    expect(runCommand('git status --porcelain').trim()).toEqual('');
  });
});
