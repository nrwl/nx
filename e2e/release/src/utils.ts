import {
  runCommandAsync,
  createFile,
  updateJson,
  removeFile,
  getSelectedPackageManager,
} from '@nx/e2e-utils';

export async function configureModernYarn() {
  if (getSelectedPackageManager() !== 'yarn') {
    return;
  }

  // These release fixtures exercise workspace lock-file updates. Yarn Classic
  // doesn't store workspace versions in yarn.lock; it has dedicated coverage in
  // lock-file-updates.test.ts. Pin only this project, never Corepack's default.
  await runCommandAsync('corepack yarn@4.0.2 set version 4.0.2 --yarn-path');
  await runCommandAsync('yarn config set nodeLinker node-modules');
  await runCommandAsync('yarn config set enableImmutableInstalls false');
}

export function setupWorkspaces(
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
  ...packages: string[]
) {
  if (packageManager === 'npm' || packageManager === 'yarn') {
    updateJson('package.json', (packageJson) => {
      packageJson.workspaces = packages;
      return packageJson;
    });
  } else if (packageManager === 'pnpm') {
    createFile(
      `pnpm-workspace.yaml`,
      `packages:
  ${packages.map((p) => `- ${p}`).join('\n  ')}
  `
    );
  }
}

export async function prepareAndInstallDependencies(
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
  installCommand: string
) {
  if (packageManager === 'npm') {
    removeFile('yarn.lock');
    removeFile('pnpm-lock.yaml');
    removeFile('pnpm-workspace.yaml');
  } else if (packageManager === 'yarn') {
    removeFile('package-lock.json');
    removeFile('pnpm-lock.yaml');
    removeFile('pnpm-workspace.yaml');
    await configureModernYarn();
  } else if (packageManager === 'pnpm') {
    removeFile('package-lock.json');
    removeFile('yarn.lock');
  }
  await runCommandAsync(installCommand);
}
