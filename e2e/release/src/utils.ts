import { detectPackageManager, createFile, updateJson } from '@nx/e2e-utils';

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
