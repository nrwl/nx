import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import { gte, major, minor, parse } from 'semver';

async function addMigrationPackageGroup(
  angularPackageMigrations: Record<string, any>,
  targetNxVersion: string,
  targetNxMigrationVersion: string,
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  const existingEntry =
    angularPackageMigrations.packageJsonUpdates[targetNxVersion];
  angularPackageMigrations.packageJsonUpdates[targetNxVersion] = {
    version: `${targetNxMigrationVersion}`,
  };

  const angularCoreRequirement = await getAngularCoreRequirement();
  if (angularCoreRequirement) {
    angularPackageMigrations.packageJsonUpdates[targetNxVersion].requires = {
      '@angular/core': angularCoreRequirement,
    };
  } else if (existingEntry?.requires) {
    // latest >= next: preserve the requires from the pre-release entry and
    // update the upper bound to the stable major.minor.0
    const angularCoreVersion = packageVersionMap.get('@angular/core');
    const { major: majorVersion, minor: minorVersion } =
      parse(angularCoreVersion)!;
    const existingReq = existingEntry.requires['@angular/core'] as string;
    const updatedReq = existingReq.replace(
      /<.*$/,
      `<${majorVersion}.${minorVersion}.0`
    );

    angularPackageMigrations.packageJsonUpdates[targetNxVersion].requires = {
      '@angular/core': updatedReq,
    };
    console.log(
      'ℹ️ - The `@angular/core` latest version is greater than or equal to the next version. Preserving existing migration requirements.'
    );
  } else {
    console.warn(
      '❗️ - The `@angular/core` latest version is greater than or equal to the next version and no existing entry found.\n' +
        '     Please manually add the requires field.'
    );
  }

  angularPackageMigrations.packageJsonUpdates[targetNxVersion].packages = {};
  for (const [pkgName, version] of packageVersionMap) {
    if (
      pkgName.startsWith('@angular/') &&
      ![
        '@angular/cli',
        '@angular/core',
        '@angular/material',
        '@angular/cdk',
        '@angular/google-maps',
        '@angular/ssr',
        '@angular/pwa',
        '@angular/build',
      ].includes(pkgName)
    ) {
      continue;
    }

    const packageUpdate: any = {
      version: isPrerelease ? version : `~${version}`,
      alwaysAddToPackageJson: pkgName === '@angular/core',
    };
    if (pkgName === '@angular/cli') {
      packageUpdate.ignorePackageGroup = true;
      packageUpdate.ignoreMigrations = true;
    }

    angularPackageMigrations.packageJsonUpdates[targetNxVersion].packages[
      pkgName
    ] = packageUpdate;
  }
}

async function getAngularCoreRequirement(): Promise<string | null> {
  const angularCoreMetadata = await axios.get(
    'https://registry.npmjs.org/@angular/core'
  );
  const { latest, next } = angularCoreMetadata.data['dist-tags'];
  // When latest >= next (e.g. a stable GA also published to the `next` tag),
  // `latest` is the new version, not the previous one - so it can't seed the
  // requires lower bound. Bail and let the caller preserve the pre-release
  // entry's requires or warn for manual entry.
  if (gte(latest, next)) {
    return null;
  }
  return `>=${major(latest)}.${minor(latest)}.0 <${next}`;
}

export async function buildMigrations(
  packageVersionMap: Map<string, string>,
  targetNxVersion: string,
  targetNxMigrationVersion: string,
  isPrerelease: boolean
) {
  console.log('⏳ - Writing migrations...');
  const pathToMigrationsJsonFile = 'packages/angular/migrations.json';
  const angularPackageMigrations = JSON.parse(
    readFileSync(pathToMigrationsJsonFile, { encoding: 'utf-8' })
  );

  await addMigrationPackageGroup(
    angularPackageMigrations,
    targetNxVersion,
    targetNxMigrationVersion,
    packageVersionMap,
    isPrerelease
  );

  writeFileSync(
    pathToMigrationsJsonFile,
    JSON.stringify(angularPackageMigrations, null, 2)
  );

  console.log('✅ - Wrote migrations');
}
