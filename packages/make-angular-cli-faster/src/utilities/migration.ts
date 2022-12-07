import { execSync } from 'child_process';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import { PackageManagerCommands } from 'nx/src/utils/package-manager';
import { gt, lt, lte, major } from 'semver';
import { resolvePackageVersion } from './package-manager';
import { MigrationDefinition } from './types';

// up to this version the generator was in the @nrwl/workspace package
const latestWorkspaceRangeVersionWithMigration = '~13.9.3';
let latestWorkspaceVersionWithMigration: string;
// up to this version the preserveAngularCLILayout option was used
const latestVersionWithOldFlag = '13.8.3';
// map of Angular major versions to the versions of Nx that are compatible with them,
// key is the Angular major version, value is an object with the range of supported
// versions
const nxAngularVersionMap: Record<number, { min: string; max?: string }> = {
  13: { min: '13.2.0', max: '~14.1.0' },
  14: { min: '14.2.0', max: '~15.1.0' },
  15: { min: '15.2.0' },
};
// latest major version of Angular that is compatible with Nx, based on the map above
const latestCompatibleAngularMajorVersion = Math.max(
  ...Object.keys(nxAngularVersionMap).map((x) => +x)
);

export async function determineMigration(
  version: string | undefined
): Promise<MigrationDefinition> {
  const angularVersion = getInstalledAngularVersion();
  const majorAngularVersion = major(angularVersion);
  latestWorkspaceVersionWithMigration = await resolvePackageVersion(
    '@nrwl/angular',
    latestWorkspaceRangeVersionWithMigration
  );
  const latestNxCompatibleVersion =
    await getNxVersionBasedOnInstalledAngularVersion(
      angularVersion,
      majorAngularVersion
    );

  if (version) {
    const normalizedVersion = await normalizeVersion(version);
    if (lte(normalizedVersion, latestWorkspaceVersionWithMigration)) {
      // specified version should use @nrwl/workspace:ng-add
      return { packageName: '@nrwl/workspace', version: normalizedVersion };
    }

    // check the versions map for compatibility with Angular
    if (
      nxAngularVersionMap[majorAngularVersion] &&
      (lt(normalizedVersion, nxAngularVersionMap[majorAngularVersion].min) ||
        (nxAngularVersionMap[majorAngularVersion].max &&
          gt(
            normalizedVersion,
            await resolvePackageVersion(
              '@nrwl/angular',
              nxAngularVersionMap[majorAngularVersion].max
            )
          )))
    ) {
      return {
        packageName: '@nrwl/angular',
        version: normalizedVersion,
        angularVersion,
        incompatibleWithAngularVersion: true,
      };
    }

    return { packageName: '@nrwl/angular', version: normalizedVersion };
  }

  // should use @nrwl/workspace:ng-add if the version is less than the
  // latest workspace version that has the migration, otherwise use
  // @nrwl/angular:ng-add
  return {
    packageName: lte(
      latestNxCompatibleVersion,
      latestWorkspaceVersionWithMigration
    )
      ? '@nrwl/workspace'
      : '@nrwl/angular',
    version: latestNxCompatibleVersion,
  };
}

export function migrateWorkspace(
  migration: MigrationDefinition,
  pmc: PackageManagerCommands
): void {
  const preserveAngularCliLayoutFlag = lte(
    migration.version,
    latestVersionWithOldFlag
  )
    ? '--preserveAngularCLILayout'
    : '--preserve-angular-cli-layout';
  execSync(
    `${pmc.exec} nx g ${migration.packageName}:ng-add ${preserveAngularCliLayoutFlag}`,
    { stdio: [0, 1, 2] }
  );
}

async function getNxVersionBasedOnInstalledAngularVersion(
  angularVersion: string,
  majorAngularVersion: number
): Promise<string> {
  if (lt(angularVersion, '13.0.0')) {
    // the @nrwl/angular:ng-add generator is only available for versions supporting
    // Angular >= 13.0.0, fall back to @nrwl/workspace:ng-add
    return latestWorkspaceVersionWithMigration;
  }
  if (nxAngularVersionMap[majorAngularVersion]?.max) {
    // use the max of the range
    return await resolvePackageVersion(
      '@nrwl/angular',
      nxAngularVersionMap[majorAngularVersion].max
    );
  }
  if (majorAngularVersion > latestCompatibleAngularMajorVersion) {
    // installed Angular version is not supported yet, we can't @nrwl/angular:ng-add,
    // fall back to @nrwl/workspace:ng-add
    return latestWorkspaceVersionWithMigration;
  }

  // use latest, only the last version in the map should not contain a max
  return await resolvePackageVersion('@nrwl/angular', 'latest');
}

function getInstalledAngularVersion(): string {
  return readModulePackageJson('@angular/core').packageJson.version;
}

async function normalizeVersion(version: string): Promise<string> {
  if (
    version.startsWith('^') ||
    version.startsWith('~') ||
    version.split('.').length < 3
  ) {
    return await resolvePackageVersion('@nrwl/angular', version);
  }

  return version;
}
