import { existsSync } from 'fs';

export function detectPackageManager() {
  return existsSync('yarn.lock')
    ? 'yarn'
    : existsSync('pnpm-lock.yaml')
    ? 'pnpm'
    : 'npm';
}

export function getPackageManagerInstallCommand(
  packageManager = detectPackageManager(),
  isDevDependency = false
) {
  if (packageManager === 'yarn') {
    return `yarn add${isDevDependency ? ' --dev' : ''}`;
  }

  return `${packageManager} install${isDevDependency ? ' --save-dev' : ''}`;
}
