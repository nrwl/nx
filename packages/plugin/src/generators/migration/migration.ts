import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'node:path';
import { PackageJson, readNxMigrateConfig } from 'nx/src/utils/package-json';
import { getArtifactMetadataDirectory } from '../../utils/paths';
import { nxVersion } from '../../utils/versions';
import { addMigrationJsonChecks } from '../lint-checks/generator';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  directory: string;
  fileName: string;
  projectRoot: string;
  projectSourceRoot: string;
  project: string;
  isTsSolutionSetup: boolean;
}

async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory,
    fileName,
    project,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    path: options.path,
    name: options.name,
    allowedFileExtensions: ['ts'],
    fileExtension: 'ts',
  });

  const { root: projectRoot, sourceRoot: projectSourceRoot } =
    readProjectConfiguration(tree, project);

  const description: string =
    options.description ?? `Migration for v${options.packageVersion}`;

  const normalized: NormalizedSchema = {
    ...options,
    directory,
    fileName,
    project,
    name,
    description,
    projectRoot,
    projectSourceRoot: projectSourceRoot ?? join(projectRoot, 'src'),
    isTsSolutionSetup: isUsingTsSolutionSetup(tree),
  };

  return normalized;
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, 'files/migration'), options.directory, {
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

  const dir = getArtifactMetadataDirectory(
    host,
    options.project,
    options.directory,
    options.isTsSolutionSetup
  );
  generators[options.name] = {
    version: options.packageVersion,
    description: options.description,
    implementation: `${dir}/${options.fileName}`,
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
    join(options.projectRoot, 'package.json'),
    (json) => {
      const addFile = (file: string) => {
        if (options.isTsSolutionSetup) {
          const filesSet = new Set(json.files ?? ['dist', '!**/*.tsbuildinfo']);
          filesSet.add(file.replace(/^\.\//, ''));
          json.files = [...filesSet];
        }
      };

      const migrationKey = json['ng-update'] ? 'ng-update' : 'nx-migrations';
      if (typeof json[migrationKey] === 'string') {
        addFile(json[migrationKey]);
        return json;
      } else if (!json[migrationKey]) {
        json[migrationKey] = {
          migrations: './migrations.json',
        };
      } else if (json[migrationKey].migrations) {
        json[migrationKey].migrations = './migrations.json';
      }

      addFile(json[migrationKey].migrations);

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
  if (options.isTsSolutionSetup) {
    return;
  }

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
  updatePackageJson(host, options);
  updateMigrationsJson(host, options);
  updateProjectConfig(host, options);

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
