import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import { gt, major, minor, parse } from 'semver';

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

  const promptAndRequirements =
    await getPromptAndRequiredVersions(packageVersionMap);
  if (promptAndRequirements) {
    angularPackageMigrations.packageJsonUpdates[targetNxVersion]['x-prompt'] =
      `Do you want to update the Angular version to ${promptAndRequirements.promptVersion}?`;
    angularPackageMigrations.packageJsonUpdates[targetNxVersion].requires = {
      '@angular/core': promptAndRequirements.angularCoreRequirement,
    };
  } else if (existingEntry?.['x-prompt'] && existingEntry?.requires) {
    // latest >= next: preserve x-prompt from the pre-release entry and
    // update the requires upper bound to the stable major.minor.0
    const angularCoreVersion = packageVersionMap.get('@angular/core');
    const { major: majorVersion, minor: minorVersion } =
      parse(angularCoreVersion)!;
    const existingReq = existingEntry.requires['@angular/core'] as string;
    const updatedReq = existingReq.replace(
      /<.*$/,
      `<${majorVersion}.${minorVersion}.0`
    );

    angularPackageMigrations.packageJsonUpdates[targetNxVersion]['x-prompt'] =
      existingEntry['x-prompt'];
    angularPackageMigrations.packageJsonUpdates[targetNxVersion].requires = {
      '@angular/core': updatedReq,
    };
    console.log(
      'ℹ️ - The `@angular/core` latest version is greater than the next version. Preserving existing migration prompt and requirements.'
    );
  } else {
    console.warn(
      '❗️ - The `@angular/core` latest version is greater than the next version and no existing entry found.\n' +
        '     Please manually add the x-prompt and requires fields.'
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

async function getPromptAndRequiredVersions(
  packageVersionMap: Map<string, string>
): Promise<{
  angularCoreRequirement: string;
  promptVersion: string;
} | null> {
  // @angular/core
  const angularCoreMetadata = await axios.get(
    'https://registry.npmjs.org/@angular/core'
  );
  const { latest, next } = angularCoreMetadata.data['dist-tags'];
  if (gt(latest, next)) {
    return null;
  }
  const angularCoreRequirement = `>=${major(latest)}.${minor(
    latest
  )}.0 <${next}`;

  // prompt version (e.g. v16 or v16.1)
  const angularCoreVersion = packageVersionMap.get('@angular/core');
  const { major: majorVersion, minor: minorVersion } =
    parse(angularCoreVersion)!;
  const promptVersion = `v${majorVersion}${
    minorVersion !== 0 ? `.${minorVersion}` : ''
  }`;

  return { angularCoreRequirement, promptVersion };
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
