import * as path from 'path';
import { execSync } from 'child_process';
import { output } from '@nrwl/workspace/src/utils/output';

export function showNxWarning(workspaceName: string) {
  try {
    const pathToRunNxCommand = path.resolve(process.cwd(), workspaceName);
    execSync('nx --version', {
      cwd: pathToRunNxCommand,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch (e) {
    // no nx found
    output.addVerticalSeparator();
    output.note({
      title: `Nx CLI is not installed globally.`,
      bodyLines: [
        `This means that you might have to use "yarn nx" or "npm nx" to execute commands in the workspace.`,
        `Run "yarn global add nx" or "npm install -g nx" to be able to execute command directly.`,
      ],
    });
  }
}

export function determinePackageManager() {
  let packageManager = getPackageManagerFromAngularCLI();
  if (packageManager === 'npm' || isPackageManagerInstalled(packageManager)) {
    return packageManager;
  }

  if (isPackageManagerInstalled('yarn')) {
    return 'yarn';
  }

  if (isPackageManagerInstalled('pnpm')) {
    return 'pnpm';
  }

  return 'npm';
}

function getPackageManagerFromAngularCLI(): string {
  // If you have Angular CLI installed, read Angular CLI config.
  // If it isn't installed, default to 'yarn'.
  try {
    return execSync('ng config -g cli.packageManager', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500,
    })
      .toString()
      .trim();
  } catch (e) {
    return 'yarn';
  }
}

function isPackageManagerInstalled(packageManager: string) {
  let isInstalled = false;
  try {
    execSync(`${packageManager} --version`, {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    isInstalled = true;
  } catch (e) {
    /* do nothing */
  }
  return isInstalled;
}
