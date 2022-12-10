import { join } from 'path';
import { execSync } from 'child_process';
import { gte, major } from 'semver';
import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { sortObjectByKeys } from 'nx/src/utils/object-sort';
import {
  resolvePackageVersionUsingInstallation,
  resolvePackageVersionUsingRegistry,
  PackageManagerCommands,
} from 'nx/src/utils/package-manager';
import { MigrationDefinition } from './types';

// version when the Nx CLI changed from @nrwl/tao & @nrwl/cli to nx
const versionWithConsolidatedPackages = '13.9.0';

export async function installDependencies(
  { packageName, version }: MigrationDefinition,
  useNxCloud: boolean,
  pmc: PackageManagerCommands
): Promise<void> {
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
    json.devDependencies['@nrwl/nx-cloud'] = await resolvePackageVersion(
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
  writeJsonFile(`package.json`, json);

  execSync(pmc.install, { stdio: [0, 1, 2] });
}

export async function resolvePackageVersion(
  packageName: string,
  version: string
): Promise<string> {
  try {
    return await resolvePackageVersionUsingRegistry(packageName, version);
  } catch {
    return await resolvePackageVersionUsingInstallation(packageName, version);
  }
}
