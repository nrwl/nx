import { Path, virtualFs } from '@angular-devkit/core';
import { HostTree } from '@angular-devkit/schematics';
import { execSync } from 'child_process';
import { Stats } from 'fs';

function fileExists(
  host: virtualFs.Host<Stats>,
  fileName: string
): Promise<boolean> {
  return host.exists(fileName as Path).toPromise();
}

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

export async function detectPackageManager(
  host: virtualFs.Host<Stats>
): Promise<string> {
  const hostTree = new HostTree(host);
  if (hostTree.get('workspace.json')) {
    const workspaceJson: { cli: { packageManager: string } } = JSON.parse(
      hostTree.read('workspace.json').toString()
    );
    if (workspaceJson.cli && workspaceJson.cli.packageManager) {
      return workspaceJson.cli.packageManager;
    }
  }

  if (await fileExists(host, 'yarn.lock')) {
    return 'yarn';
  }

  if (await fileExists(host, 'pnpm-lock.yaml')) {
    return 'pnpm';
  }

  if (await fileExists(host, 'package-lock.json')) {
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
