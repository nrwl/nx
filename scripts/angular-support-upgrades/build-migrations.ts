import axios from 'axios';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { gt, major, minor, parse } from 'semver';
import {
  getAngularCliMigrationGenerator,
  getAngularCliMigrationGeneratorSpec,
} from './files/angular-cli-upgrade-migration';

async function addMigrationPackageGroup(
  angularPackageMigrations: Record<string, any>,
  targetNxVersion: string,
  targetNxMigrationVersion: string,
  packageVersionMap: Map<string, string>
) {
  angularPackageMigrations.packageJsonUpdates[targetNxVersion] = {
    version: `${targetNxMigrationVersion}`,
    packages: {},
  };

  const promptAndRequirements = await getPromptAndRequiredVersions(
    packageVersionMap
  );
  if (!promptAndRequirements) {
    console.warn(
      '❗️ - The `@angular/core` latest version is greater than the next version. Skipping generating migration prompt and requirements.\n' +
        '     Please review the migrations and manually add the prompt and requirements if needed.'
    );
  } else {
    angularPackageMigrations.packageJsonUpdates[targetNxVersion][
      'x-prompt'
    ] = `Do you want to update the Angular version to ${promptAndRequirements.promptVersion}?`;
    angularPackageMigrations.packageJsonUpdates[targetNxVersion].requires = {
      '@angular/core': promptAndRequirements.angularCoreRequirement,
    };
  }

  for (const [pkgName, version] of packageVersionMap.entries()) {
    if (
      pkgName.startsWith('@angular/') &&
      !['@angular/core', '@angular/material', '@angular/cdk'].includes(pkgName)
    ) {
      continue;
    }

    angularPackageMigrations.packageJsonUpdates[targetNxVersion].packages[
      pkgName
    ] = {
      version: `~${version}`,
      alwaysAddToPackageJson: pkgName === '@angular/core',
    };
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
  targetNxMigrationVersion: string
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
    packageVersionMap
  );

  const angularCLIVersion = packageVersionMap.get('@angular/cli') as string;
  const angularCliMigrationGeneratorContents =
    getAngularCliMigrationGenerator(angularCLIVersion);
  const angularCliMigrationGeneratorSpecContents =
    getAngularCliMigrationGeneratorSpec();

  // Create the directory update-targetNxVersion.dasherize()
  // Write the generator
  // Update angularPackageMigrations

  const migrationGeneratorFolderName =
    'update-' + targetNxVersion.replace(/\./g, '-');
  const migrationFileName = 'update-angular-cli';
  const generatorName = `update-angular-cli-version-${angularCLIVersion.replace(
    /\./g,
    '-'
  )}`;

  const angularCoreVersion = packageVersionMap.get('@angular/core');
  angularPackageMigrations.generators[generatorName] = {
    cli: 'nx',
    version: targetNxMigrationVersion,
    requires: {
      '@angular/core': `>=${angularCoreVersion}`,
    },
    description: `Update the @angular/cli package version to ~${angularCLIVersion}.`,
    factory: `./src/migrations/${migrationGeneratorFolderName}/${migrationFileName}`,
  };

  writeFileSync(
    pathToMigrationsJsonFile,
    JSON.stringify(angularPackageMigrations, null, 2)
  );

  const pathToMigrationFolder = join(
    'packages/angular/src/migrations',
    migrationGeneratorFolderName
  );
  if (!existsSync(pathToMigrationFolder)) {
    mkdirSync(pathToMigrationFolder);
  }

  const pathToMigrationGeneratorFile = join(
    pathToMigrationFolder,
    `${migrationFileName}.ts`
  );
  const pathToMigrationGeneratorSpecFile = join(
    pathToMigrationFolder,
    `${migrationFileName}.spec.ts`
  );
  writeFileSync(
    pathToMigrationGeneratorFile,
    angularCliMigrationGeneratorContents
  );
  writeFileSync(
    pathToMigrationGeneratorSpecFile,
    angularCliMigrationGeneratorSpecContents
  );

  console.log('✅ - Wrote migrations');
}
