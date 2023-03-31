import { execSync } from 'child_process';
import { join } from 'path';
import { gte, major } from 'semver';
import { readJsonFile, writeJsonFile } from '../../utils/fileutils';
import { sortObjectByKeys } from '../../utils/object-sort';
import { output } from '../../utils/output';
import { readModulePackageJson } from '../../utils/package-json';
import {
  PackageManagerCommands,
  getPackageManagerCommand,
  resolvePackageVersionUsingInstallation,
  resolvePackageVersionUsingRegistry,
} from '../../utils/package-manager';
import { askAboutNxCloud, initCloud } from '../utils';

// map of Angular major versions to Nx versions to use for legacy `nx init` migrations,
// key is major Angular version and value is Nx version to use
const nxAngularLegacyVersionMap: Record<number, string> = {};
// min major angular version supported in latest Nx
const minMajorAngularVersionSupported = 14;
// version when the Nx CLI changed from @nrwl/tao & @nrwl/cli to nx
const versionWithConsolidatedPackages = '13.9.0';

export async function getLegacyMigrationFunctionIfApplicable(
  repoRoot: string,
  interactive: boolean
): Promise<() => Promise<void> | null> {
  const angularVersion =
    readModulePackageJson('@angular/core').packageJson.version;
  const majorAngularVersion = major(angularVersion);
  if (majorAngularVersion >= minMajorAngularVersionSupported) {
    // non-legacy
    return null;
  }

  let legacyMigrationCommand: string;
  let pkgName: string;
  let pkgVersion: string;
  if (majorAngularVersion < 13) {
    // for versions lower than 13, the migration was in @nrwl/workspace:ng-add
    pkgName = '@nrwl/workspace';
    pkgVersion = await resolvePackageVersion(
      pkgName,
      `^${majorAngularVersion}.0.0`
    );
    legacyMigrationCommand = `ng g ${pkgName}:ng-add --preserveAngularCLILayout`;
  } else if (majorAngularVersion < 14) {
    // for v13, the migration was in @nrwl/angular:ng-add
    pkgName = '@nrwl/angular';
    pkgVersion = await resolvePackageVersion(pkgName, '~14.1.0');
    legacyMigrationCommand = `ng g ${pkgName}:ng-add --preserve-angular-cli-layout`;
  } else {
    // use the latest Nx version that supported the Angular version
    pkgName = '@nrwl/angular';
    pkgVersion = await resolvePackageVersion(
      'nx',
      nxAngularLegacyVersionMap[majorAngularVersion]
    );
    legacyMigrationCommand = `nx@${pkgVersion} init ${process.argv
      .slice(2)
      .join(' ')}`;
  }

  return async () => {
    output.log({ title: '🐳 Nx initialization' });
    const useNxCloud = interactive ? await askAboutNxCloud() : false;

    output.log({ title: '📦 Installing dependencies' });
    const pmc = getPackageManagerCommand();
    await installDependencies(repoRoot, pkgName, pkgVersion, useNxCloud, pmc);

    output.log({ title: '📝 Setting up workspace' });
    execSync(`${pmc.exec} ${legacyMigrationCommand}`, { stdio: [0, 1, 2] });

    if (useNxCloud) {
      output.log({ title: '🛠️ Setting up Nx Cloud' });
      initCloud(repoRoot, 'nx-init-angular');
    }

    output.success({
      title: '🎉 Nx is now enabled in your workspace!',
      bodyLines: [
        `Execute 'npx nx build' twice to see the computation caching in action.`,
        'Learn more about the changes done to your workspace at https://nx.dev/recipes/adopting-nx/migration-angular.',
      ],
    });
  };
}

async function installDependencies(
  repoRoot: string,
  pkgName: string,
  pkgVersion: string,
  useNxCloud: boolean,
  pmc: PackageManagerCommands
): Promise<void> {
  const json = readJsonFile(join(repoRoot, 'package.json'));

  json.devDependencies ??= {};
  json.devDependencies['@nrwl/workspace'] = pkgVersion;

  if (gte(pkgVersion, versionWithConsolidatedPackages)) {
    json.devDependencies['nx'] = pkgVersion;
  } else {
    json.devDependencies['@nrwl/cli'] = pkgVersion;
    json.devDependencies['@nrwl/tao'] = pkgVersion;
  }

  if (useNxCloud) {
    // get the latest @nrwl/nx-cloud version compatible with the Nx major
    // version being installed
    json.devDependencies['@nrwl/nx-cloud'] = await resolvePackageVersion(
      '@nrwl/nx-cloud',
      `^${major(pkgVersion)}.0.0`
    );
  }
  json.devDependencies = sortObjectByKeys(json.devDependencies);

  if (pkgName === '@nrwl/angular') {
    json.dependencies ??= {};
    json.dependencies['@nrwl/angular'] = pkgVersion;
    json.dependencies = sortObjectByKeys(json.dependencies);
  }
  writeJsonFile(`package.json`, json);

  execSync(pmc.install, { stdio: [0, 1, 2] });
}

async function resolvePackageVersion(
  packageName: string,
  version: string
): Promise<string> {
  try {
    return await resolvePackageVersionUsingRegistry(packageName, version);
  } catch {
    return await resolvePackageVersionUsingInstallation(packageName, version);
  }
}
