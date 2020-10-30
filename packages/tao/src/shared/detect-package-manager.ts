import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import * as stripJsonComments from 'strip-json-comments';

function isPackageManagerInstalled(packageManager: string) {
  try {
    execSync(`${packageManager} --version`, {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch (e) {
    return false;
  }
}

export function detectPackageManager() {
  const workspaceJsonPath = [`workspace.json`, `angular.json`].find((p) =>
    existsSync(p)
  );

  if (workspaceJsonPath) {
    const workspaceJson = JSON.parse(
      stripJsonComments(readFileSync(workspaceJsonPath).toString())
    );
    if (workspaceJson.cli && workspaceJson.cli.packageManager) {
      return workspaceJson.cli.packageManager;
    }
  }

  if (existsSync('yarn.lock')) {
    return 'yarn';
  }

  if (existsSync('pnpm-lock.yaml')) {
    return 'pnpm';
  }

  if (existsSync('package-lock.json')) {
    return 'npm';
  }

  // If we get here, there are no lock files,
  // so lets check for package managers in our preferred order
  if (isPackageManagerInstalled('yarn')) {
    return 'yarn';
  }

  if (isPackageManagerInstalled('pnpm')) {
    return 'pnpm';
  }

  return 'npm';
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
