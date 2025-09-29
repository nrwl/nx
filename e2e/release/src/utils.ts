import {
  runCommandAsync,
  createFile,
  updateJson,
  removeFile,
} from '@nx/e2e-utils';

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
    updateJson('package.json', (pkgJson) => {
      delete pkgJson.packageManager;
      return pkgJson;
    });
    await runCommandAsync(`yarn config set enableImmutableInstalls false`);
  } else if (packageManager === 'pnpm') {
    removeFile('package-lock.json');
    removeFile('yarn.lock');
  }
  await runCommandAsync(installCommand);
}
