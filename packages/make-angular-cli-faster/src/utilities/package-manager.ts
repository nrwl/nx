import {
  getPackageManagerCommand,
  readJsonFile,
  workspaceRoot,
} from '@nrwl/devkit';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { sortObjectByKeys } from 'nx/src/utils/object-sort';
import {
  resolvePackageVersionUsingInstallation,
  resolvePackageVersionUsingRegistry,
} from 'nx/src/utils/package-manager';
import { join } from 'path';
import { gte, major } from 'semver';
import { MigrationDefinition } from './types';

// version when the Nx CLI changed from @nrwl/tao & @nrwl/cli to nx
const versionWithConsolidatedPackages = '13.9.0';

export function installDependencies(
  { packageName, version }: MigrationDefinition,
  useNxCloud: boolean
): void {
  const json = readJsonFile(join(workspaceRoot, 'package.json'));

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
  try {
    return resolvePackageVersionUsingRegistry(packageName, version);
  } catch {
    return resolvePackageVersionUsingInstallation(packageName, version);
  }
}
