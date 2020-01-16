import { appRootPath } from '@nrwl/workspace/src/utils/app-root';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import { tmpProjPath } from './paths';
import { cleanup, copyNodeModules } from './utils';

function runNxNewCommand(args?: string, silent?: boolean) {
  const localTmpDir = `./tmp/nx-e2e`;
  return execSync(
    `node ${require.resolve(
      '@nrwl/tao'
    )} new proj --no-interactive --skip-install --collection=@nrwl/workspace --npmScope=proj ${args ||
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
  runNxNewCommand('', true);
  patchPackageJsonForPlugin(npmPackageName, pluginDistPath);
  runYarnInstall();
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
  copyNodeModules(['@nrwl']);
}
