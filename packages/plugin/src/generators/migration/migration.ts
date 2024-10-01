import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import type { Schema } from './schema';
import * as path from 'path';
import { relative } from 'path';
import { addMigrationJsonChecks } from '../lint-checks/generator';
import { PackageJson, readNxMigrateConfig } from 'nx/src/utils/package-json';
import { nxVersion } from '../../utils/versions';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

interface NormalizedSchema extends Schema {
  directory: string;
  projectRoot: string;
  projectSourceRoot: string;
  project: string;
}

async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  let name: string;
  if (options.name) {
    name = names(options.name).fileName;
  } else {
    name = names(`update-${options.packageVersion}`).fileName;
  }

  const { project, fileName, artifactName, filePath, directory } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      name: name,
      path: options.path,
      fileName: name,
    });

  const { root: projectRoot, sourceRoot: projectSourceRoot } =
    readProjectConfiguration(tree, project);

  const description: string =
    options.description ?? `Migration for v${options.packageVersion}`;

  // const { root: projectRoot, sourceRoot: projectSourceRoot } =
  //   readProjectConfiguration(host, options.project);

  const normalized: NormalizedSchema = {
    ...options,
    directory,
    project,
    name: artifactName,
    description,
    projectRoot,
    projectSourceRoot,
  };

  return normalized;
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, path.join(__dirname, 'files/migration'), options.path, {
    ...options,
    tmpl: '',
  });
}

function updateMigrationsJson(host: Tree, options: NormalizedSchema) {
  const configuredMigrationPath = readNxMigrateConfig(
    readJson<PackageJson>(
      host,
      joinPathFragments(options.projectRoot, 'package.json')
    )
  ).migrations;
  const migrationsPath = joinPathFragments(
    options.projectRoot,
    configuredMigrationPath ?? 'migrations.json'
  );
  const migrations = host.exists(migrationsPath)
    ? readJson(host, migrationsPath)
    : {};

  const generators = migrations.generators ?? {};
  generators[options.name] = {
    version: options.packageVersion,
    description: options.description,
    implementation: `./${joinPathFragments(
      relative(options.projectRoot, options.path),
      options.name
    )}`,
  };
  migrations.generators = generators;

  if (options.packageJsonUpdates) {
    const packageJsonUpdatesObj = migrations.packageJsonUpdates ?? {};
    if (!packageJsonUpdatesObj[options.packageVersion]) {
      packageJsonUpdatesObj[options.packageVersion] = {
        version: options.packageVersion,
        packages: {},
      };
    }
    migrations.packageJsonUpdates = packageJsonUpdatesObj;
  }

  writeJson(host, migrationsPath, migrations);
}

function updatePackageJson(host: Tree, options: NormalizedSchema) {
  updateJson<PackageJson>(
    host,
    path.join(options.projectRoot, 'package.json'),
    (json) => {
      const migrationKey = json['ng-update'] ? 'ng-update' : 'nx-migrations';
      const preexistingValue = json[migrationKey];
      if (typeof preexistingValue === 'string') {
        return json;
      } else if (!json[migrationKey]) {
        json[migrationKey] = {
          migrations: './migrations.json',
        };
      } else if (preexistingValue.migrations) {
        preexistingValue.migrations = './migrations.json';
      }

      // add dependencies
      json.dependencies = {
        '@nx/devkit': nxVersion,
        ...json.dependencies,
      };

      return json;
    }
  );
}

function updateProjectConfig(host: Tree, options: NormalizedSchema) {
  const project = readProjectConfiguration(host, options.project);

  const assets = project.targets.build?.options?.assets;
  if (
    assets &&
    (assets as any[]).filter((a) => a.glob === 'migrations.json').length === 0
  ) {
    project.targets.build.options.assets = [
      ...assets,
      {
        input: `./${options.projectRoot}`,
        glob: 'migrations.json',
        output: '.',
      },
    ];
    updateProjectConfiguration(host, options.project, project);
  }
}

export async function migrationGenerator(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);

  addFiles(host, options);
  updateMigrationsJson(host, options);
  updateProjectConfig(host, options);
  updateMigrationsJson(host, options);
  updatePackageJson(host, options);

  if (!host.exists('migrations.json')) {
    const packageJsonPath = joinPathFragments(
      options.projectRoot,
      'package.json'
    );
    addMigrationJsonChecks(
      host,
      { projectName: options.project },
      readJson<PackageJson>(host, packageJsonPath)
    );
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

export default migrationGenerator;
