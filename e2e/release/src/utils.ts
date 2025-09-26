import { detectPackageManager, createFile, updateJson } from '@nx/e2e-utils';

export function setupWorkspaces(...packages: string[]) {
  const pkgManager = detectPackageManager();
  if (pkgManager === 'npm' || pkgManager === 'yarn') {
    updateJson('package.json', (packageJson) => {
      packageJson.workspaces = packages;
      return packageJson;
    });
  } else if (pkgManager === 'pnpm') {
    createFile(
      `pnpm-workspace.yaml`,
      `
packages:
  ${packages.map((p) => `- ${p}`).join('\n  ')}
  `
    );
  }
}
