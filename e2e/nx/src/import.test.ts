import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  updateJson,
  updateFile,
  e2eCwd,
} from '@nx/e2e/utils';
import { writeFileSync, mkdirSync, rmdirSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'path';

describe('Nx Import', () => {
  let proj: string;
  const tempImportE2ERoot = join(e2eCwd, 'nx-import');
  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/js'],
      unsetProjectNameAndRootFormat: false,
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
      rmdirSync(join(tempImportE2ERoot));
    } catch {}
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
    execSync(`git checkout -b main`, {
      cwd: tempViteProjectPath,
    });

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
    // Setup repo with two packages: a and b
    const repoPath = join(tempImportE2ERoot, 'repo');
    mkdirSync(repoPath, { recursive: true });
    writeFileSync(join(repoPath, 'README.md'), `# Repo`);
    execSync(`git init`, {
      cwd: repoPath,
    });
    execSync(`git add .`, {
      cwd: repoPath,
    });
    execSync(`git commit -am "initial commit"`, {
      cwd: repoPath,
    });
    execSync(`git checkout -b main`, {
      cwd: repoPath,
    });
    mkdirSync(join(repoPath, 'packages/a'), { recursive: true });
    writeFileSync(join(repoPath, 'packages/a/README.md'), `# A`);
    execSync(`git add packages/a`, {
      cwd: repoPath,
    });
    execSync(`git commit -m "add package a"`, {
      cwd: repoPath,
    });
    mkdirSync(join(repoPath, 'packages/b'), { recursive: true });
    writeFileSync(join(repoPath, 'packages/b/README.md'), `# B`);
    execSync(`git add packages/b`, {
      cwd: repoPath,
    });
    execSync(`git commit -m "add package b"`, {
      cwd: repoPath,
    });

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

    checkFilesExist('packages/a/README.md', 'packages/b/README.md');
  });
});
