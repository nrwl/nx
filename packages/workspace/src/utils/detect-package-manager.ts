import { fileExists } from './fileutils';

export function detectPackageManager(): string {
  return fileExists('yarn.lock')
    ? 'yarn'
    : fileExists('pnpm-lock.yaml')
    ? 'pnpm'
    : 'npm';
}

export function getPackageManagerExecuteCommand(
  packageManager = detectPackageManager()
) {
  if (packageManager === 'yarn') {
    return `yarn`;
  }

  if (packageManager === 'pnpm') {
    return `pnpx`;
  }

  return `npx`;
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
