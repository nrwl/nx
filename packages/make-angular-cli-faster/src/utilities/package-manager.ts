import {
  getPackageManagerCommand,
  readJsonFile,
  writeJsonFile,
} from '@nrwl/devkit';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { appRootPath } from 'nx/src/utils/app-root';
import { sortObjectByKeys } from 'nx/src/utils/object-sort';
import { dirname, join } from 'path';
import { gte, lt, major } from 'semver';
import { dirSync } from 'tmp';
import { MigrationDefinition } from './types';

// version when the Nx CLI changed from @nrwl/tao & @nrwl/cli to nx
const versionWithConsolidatedPackages = '13.9.0';

export function installDependencies(
  { packageName, version }: MigrationDefinition,
  useNxCloud: boolean
): void {
  const json = readJsonFile(join(appRootPath, 'package.json'));

  json.devDependencies ??= {};
  json.devDependencies['@nrwl/workspace'] = version;

  if (gte(version, versionWithConsolidatedPackages)) {
    json.devDependencies['nx'] = version;
  } else {
    json.devDependencies['@nrwl/cli'] = version;
    json.devDependencies['@nrwl/tao'] = version;
  }

  if (useNxCloud) {
    // get the latest @nrwl/nx-cloud version compatible with the Nx major
    // version being installed
    json.devDependencies['@nrwl/nx-cloud'] = resolvePackageVersion(
      '@nrwl/nx-cloud',
      `^${major(version)}.0.0`
    );
  }
  json.devDependencies = sortObjectByKeys(json.devDependencies);

  if (packageName === '@nrwl/angular') {
    json.dependencies ??= {};
    json.dependencies['@nrwl/angular'] = version;
    json.dependencies = sortObjectByKeys(json.dependencies);
  }
  writeFileSync(`package.json`, JSON.stringify(json, null, 2));

  execSync(getPackageManagerCommand().install, {
    stdio: [0, 1, 2],
  });
}

export function resolvePackageVersion(
  packageName: string,
  version: string
): string {
  const dir = dirSync().name;
  const npmrc = checkForNPMRC();
  if (npmrc) {
    // Creating a package.json is needed for .npmrc to resolve
    writeJsonFile(`${dir}/package.json`, {});
    // Copy npmrc if it exists, so that npm still follows it.
    copyFileSync(npmrc, `${dir}/.npmrc`);
  }

  const pmc = getPackageManagerCommand();
  execSync(`${pmc.add} ${packageName}@${version}`, { stdio: [], cwd: dir });

  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [dir],
  });
  const { version: resolvedVersion } = readJsonFile(packageJsonPath);

  try {
    unlinkSync(dir);
  } catch {
    // It's okay if this fails, the OS will clean it up eventually
  }

  return resolvedVersion;
}

function checkForNPMRC(): string | null {
  let directory = process.cwd();
  while (!existsSync(join(directory, 'package.json'))) {
    directory = dirname(directory);
  }
  const path = join(directory, '.npmrc');
  return existsSync(path) ? path : null;
}
