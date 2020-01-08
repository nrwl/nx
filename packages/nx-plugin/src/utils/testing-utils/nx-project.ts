import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { copySync, ensureDirSync, moveSync } from 'fs-extra';
import { tmpBackupProjPath, tmpProjPath } from './paths';
import { cleanup, directoryExists } from './utils';
import { appRootPath } from '@nrwl/workspace/src/utils/app-root';

function runNxNewCommand(args?: string, silent?: boolean) {
  const localTmpDir = `./tmp-e2e/nx`;
  return execSync(
    `npx tao new proj --no-interactive --skip-install --collection=@nrwl/workspace --npmScope=proj ${args ||
      ''}`,
    {
      cwd: localTmpDir,
      ...(silent && false ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
    }
  );
}

function patchPackageJsonForPlugin(npmPackageName: string, distPath: string) {
  const p = JSON.parse(readFileSync(tmpProjPath('package.json')).toString());
  p.devDependencies[npmPackageName] = `file:${appRootPath}/${distPath}`;
  writeFileSync(tmpProjPath('package.json'), JSON.stringify(p, null, 2));
}

/**
 * Generate a unique name for running CLI commands
 * @param prefix
 */
export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

export function runYarnInstall(silent: boolean = true) {
  const install = execSync('yarn install', {
    cwd: tmpProjPath(),
    ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
  });
  return install ? install.toString() : '';
}

/**
 * Sets up a new project in the temporary project path
 * for the currently selected CLI.
 */
export function newNxProject(
  npmPackageName: string,
  pluginDistPath: string
): void {
  cleanup();
  //   if (!directoryExists(tmpBackupProjPath())) {
  runNxNewCommand('', true);
  patchPackageJsonForPlugin(npmPackageName, pluginDistPath);
  runYarnInstall();
  //     moveSync(tmpProjPath(), tmpBackupProjPath());
  //   }
  //   copySync(tmpBackupProjPath(), tmpProjPath(), {});
}

/**
 * Ensures that a project has been setup
 * in the temporary project path
 *
 * If one is not found, it creates a new project.
 */
export function ensureNxProject(
  npmPackageName?: string,
  pluginDistPath?: string
): void {
  ensureDirSync(tmpProjPath());
  newNxProject(npmPackageName, pluginDistPath);
}
