import {
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  updateJson,
  updateFile,
  e2eCwd,
  runCommand,
  createFile,
} from '@nx/e2e-utils';
import { mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

export const tempImportE2ERoot = join(e2eCwd, 'nx-import');

export function setupGradleImportProject() {
  newProject({
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

  createFile('.gitignore', '.kotlin/');

  try {
    rmdirSync(tempImportE2ERoot);
  } catch {}
  mkdirSync(tempImportE2ERoot, { recursive: true });

  runCommand(`git add .`);
  runCommand(`git commit -am "update"`);
}

export function teardownGradleImportProject() {
  cleanupProject();
}
