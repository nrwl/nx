import { detectPackageManager, workspaceRoot } from '@nx/devkit';
import {
  getPackageManagerCommand,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'path';
import { tmpProjPath } from './paths';
import { cleanup } from './utils';

function runNxNewCommand(args?: string, silent?: boolean) {
  const localTmpDir = dirname(tmpProjPath());
  return execSync(
    `node ${require.resolve(
      'nx'
    )} new proj --nx-workspace-root=${localTmpDir} --no-interactive --skip-install --collection=@nx/workspace --npmScope=proj --preset=apps ${
      args || ''
    }`,
    {
      cwd: localTmpDir,
      ...(silent && false ? { stdio: ['ignore', 'ignore', 'ignore'] } : {}),
      windowsHide: false,
    }
  );
}

export function patchPackageJsonForPlugin(
  npmPackageName: string,
  distPath: string
) {
  const path = tmpProjPath('package.json');
  const json = readJsonFile(path);
  json.devDependencies[npmPackageName] = `file:${workspaceRoot}/${distPath}`;
  writeJsonFile(path, json);
}

/**
 * Generate a unique name for running CLI commands
 * @param prefix
 *
 * @returns `'<prefix><random number>'`
 */
export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

/**
 * Run the appropriate package manager install command in the e2e directory
 * @param silent silent output from the install
 */
export function runPackageManagerInstall(silent: boolean = true) {
  const cwd = tmpProjPath();
  const pmc = getPackageManagerCommand(detectPackageManager(cwd));
  const install = execSync(pmc.install, {
    cwd,
    ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {}),
    windowsHide: false,
  });
  return install ? install.toString() : '';
}

/**
 * Creates a new nx project in the e2e directory
 *
 * @param npmPackageName package name to test
 * @param pluginDistPath dist path where the plugin was outputted to
 */
export function newNxProject(
  npmPackageName: string,
  pluginDistPath: string
): void {
  cleanup();
  runNxNewCommand('', true);
  patchPackageJsonForPlugin(npmPackageName, pluginDistPath);
  runPackageManagerInstall();
}

/**
 * Ensures that a project has been setup in the e2e directory
 * It will also copy `@nx` packages to the e2e directory
 */
export function ensureNxProject(
  npmPackageName?: string,
  pluginDistPath?: string
): void {
  mkdirSync(tmpProjPath(), { recursive: true });
  newNxProject(npmPackageName, pluginDistPath);
}
