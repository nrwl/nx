import { execSync } from 'child_process';
import { getPackageManagerCommand } from '@nrwl/devkit';
import { tmpProjPath } from './paths';

/**
 * Run the appropriate package manager install command
 * @param silent silent output from the install
 * @param path path of where the install command will be run, by default the e2e directory
 */
export function runPackageManagerInstall(
  silent: boolean = true,
  path: string = tmpProjPath()
) {
  const pmc = getPackageManagerCommand();
  const install = execSync(pmc.install, {
    cwd: path,
    ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {}),
  });
  return install ? install.toString() : '';
}
