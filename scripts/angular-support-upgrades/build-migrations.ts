import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
  getAngularCliMigrationGenerator,
  getAngularCliMigrationGeneratorSpec,
} from './files/angular-cli-upgrade-migration';
import { join } from 'path';

function addMigrationPackageGroup(
  angularPackageMigrations: Record<string, any>,
  targetNxVersion: string,
  targetNxMigrationVersion: string,
  packageVersionMap: Map<string, string>
) {
  angularPackageMigrations.packageJsonUpdates[targetNxVersion] = {
    version: `${targetNxMigrationVersion}`,
    packages: {},
  };

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

export function buildMigrations(
  packageVersionMap: Map<string, string>,
  targetNxVersion: string,
  targetNxMigrationVersion: string
) {
  console.log('⏳ - Writing migrations...');
  const pathToMigrationsJsonFile = 'packages/angular/migrations.json';
  const angularPackageMigrations = JSON.parse(
    readFileSync(pathToMigrationsJsonFile, { encoding: 'utf-8' })
  );

  addMigrationPackageGroup(
    angularPackageMigrations,
    targetNxVersion,
    targetNxMigrationVersion,
    packageVersionMap
  );

  const angularCLIVersion = packageVersionMap.get('@angular/cli') as string;
  const angularCliMigrationGeneratorContents =
    getAngularCliMigrationGenerator(angularCLIVersion);
  const angularCliMigrationGeneratorSpecContents =
    getAngularCliMigrationGeneratorSpec(angularCLIVersion);

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

  angularPackageMigrations.schematics[generatorName] = {
    cli: 'nx',
    version: targetNxMigrationVersion,
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
