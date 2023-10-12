import {
  readProjectConfiguration,
  names,
  convertNxGenerator,
  generateFiles,
  updateJson,
  joinPathFragments,
  writeJson,
  readJson,
  ExecutorsJson,
  formatFiles,
  normalizePath,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import type { Schema } from './schema';
import * as path from 'path';
import { PackageJson } from 'nx/src/utils/package-json';
import pluginLintCheckGenerator from '../lint-checks/generator';
import { nxVersion } from '../../utils/versions';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { join, relative } from 'path';

interface NormalizedSchema extends Schema {
  fileName: string;
  className: string;
  propertyName: string;
  projectRoot: string;
  filePath: string;
  directory: string;
  npmScope: string;
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    path.join(__dirname, './files/executor'),
    options.directory,
    {
      ...options,
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(joinPathFragments(options.directory, `executor.spec.ts`));
  }
}

function addHasherFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    path.join(__dirname, './files/hasher'),
    options.directory,
    {
      ...options,
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(joinPathFragments(options.directory, 'hasher.spec.ts'));
  }
}

export async function createExecutorsJson(
  host: Tree,
  projectRoot: string,
  projectName: string,
  skipLintChecks?: boolean
) {
  updateJson<PackageJson>(
    host,
    joinPathFragments(projectRoot, 'package.json'),
    (json) => {
      json.executors ??= './executors.json';
      return json;
    }
  );
  writeJson<ExecutorsJson>(
    host,
    joinPathFragments(projectRoot, 'executors.json'),
    {
      executors: {},
    }
  );
  if (!skipLintChecks) {
    await pluginLintCheckGenerator(host, {
      projectName,
    });
  }
}

async function updateExecutorJson(host: Tree, options: NormalizedSchema) {
  const packageJson = readJson<PackageJson>(
    host,
    joinPathFragments(options.projectRoot, 'package.json')
  );

  const packageJsonExecutors = packageJson.executors ?? packageJson.builders;
  let executorsPath = packageJsonExecutors
    ? joinPathFragments(options.projectRoot, packageJsonExecutors)
    : null;

  if (!executorsPath) {
    executorsPath = joinPathFragments(options.projectRoot, 'executors.json');
  }
  if (!host.exists(executorsPath)) {
    await createExecutorsJson(
      host,
      options.projectRoot,
      options.project,
      options.skipLintChecks
    );
  }
  // add dependencies
  updateJson<PackageJson>(
    host,
    joinPathFragments(options.projectRoot, 'package.json'),
    (json) => {
      json.dependencies = {
        '@nx/devkit': nxVersion,
        ...json.dependencies,
      };
      return json;
    }
  );

  return updateJson(host, executorsPath, (json) => {
    let executors = json.executors ?? json.builders;
    executors ||= {};
    executors[options.name] = {
      implementation: `./${normalizePath(
        relative(options.projectRoot, join(options.directory, 'executor'))
      )}`,
      schema: `./${normalizePath(
        relative(options.projectRoot, join(options.directory, 'schema.json'))
      )}`,
      description: options.description,
    };
    if (options.includeHasher) {
      executors[options.name].hasher = `./${normalizePath(
        relative(options.projectRoot, join(options.directory, 'hasher'))
      )}`;
    }
    json.executors = executors;

    return json;
  });
}

async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const npmScope = getNpmScope(tree);

  const res = await determineArtifactNameAndDirectoryOptions(tree, {
    artifactType: 'executor',
    callingGenerator: '@nx/plugin:executor',
    name: options.name,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    directory: options.directory,
    fileName: 'executor',
    derivedDirectory: 'executors',
  });

  const { project, fileName, artifactName, filePath, directory } = res;

  const { className, propertyName } = names(artifactName);

  const { root: projectRoot } = readProjectConfiguration(tree, project);

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} executor`;
  }

  return {
    ...options,
    filePath,
    project,
    directory,
    fileName,
    className,
    propertyName,
    description,
    projectRoot,
    npmScope,
  };
}

export async function executorGenerator(tree: Tree, rawOptions: Schema) {
  await executorGeneratorInternal(tree, {
    nameAndDirectoryFormat: 'derived',
    ...rawOptions,
  });
}

export async function executorGeneratorInternal(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);

  addFiles(host, options);
  if (options.includeHasher) {
    addHasherFiles(host, options);
  }

  await updateExecutorJson(host, options);

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

export default executorGenerator;
export const executorSchematic = convertNxGenerator(executorGenerator);
