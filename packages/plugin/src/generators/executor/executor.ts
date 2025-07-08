import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
  type ExecutorsJson,
  type Tree,
} from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { PackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import { getArtifactMetadataDirectory } from '../../utils/paths';
import { nxVersion } from '../../utils/versions';
import pluginLintCheckGenerator from '../lint-checks/generator';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  className: string;
  propertyName: string;
  projectRoot: string;
  projectSourceRoot: string;
  fileName: string;
  directory: string;
  project: string;
  isTsSolutionSetup: boolean;
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, './files/executor'), options.directory, {
    ...options,
  });

  if (options.unitTestRunner === 'none') {
    host.delete(
      joinPathFragments(options.directory, `${options.fileName}.spec.ts`)
    );
  }
}

function addHasherFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, './files/hasher'), options.directory, {
    ...options,
  });

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

    if (options.isTsSolutionSetup) {
      updateJson<PackageJson>(
        host,
        joinPathFragments(options.projectRoot, 'package.json'),
        (json) => {
          const filesSet = new Set(json.files ?? ['dist', '!**/*.tsbuildinfo']);
          filesSet.add('executors.json');
          json.files = [...filesSet];
          return json;
        }
      );
    }
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

    const dir = getArtifactMetadataDirectory(
      host,
      options.project,
      options.directory,
      options.isTsSolutionSetup
    );
    executors[options.name] = {
      implementation: `${dir}/${options.fileName}`,
      schema: `${dir}/schema.json`,
      description: options.description,
    };
    if (options.includeHasher) {
      executors[options.name].hasher = `${dir}/hasher`;
    }
    json.executors = executors;

    return json;
  });
}

async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory: initialDirectory,
    fileName,
    project,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    path: options.path,
    name: options.name,
    allowedFileExtensions: ['ts'],
    fileExtension: 'ts',
  });

  // Check if the path looks like a directory path (doesn't end with a filename)
  // If so, include the artifact name as a subdirectory
  let directory = initialDirectory;
  const normalizedPath = options.path.replace(/^\.?\//, '').replace(/\/$/, '');
  const pathSegments = normalizedPath.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // If the last segment doesn't contain a file extension and matches the artifact name,
  // it's likely a directory path, so we should create a subdirectory
  if (!lastSegment.includes('.') && lastSegment === name) {
    directory = joinPathFragments(initialDirectory, name);
  }

  const { className, propertyName } = names(name);

  const { root: projectRoot, sourceRoot: projectSourceRoot } =
    readProjectConfiguration(tree, project);

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${name} executor`;
  }

  return {
    ...options,
    fileName,
    project,
    directory,
    name,
    className,
    propertyName,
    description,
    projectRoot,
    projectSourceRoot: projectSourceRoot ?? join(projectRoot, 'src'),
    isTsSolutionSetup: isUsingTsSolutionSetup(tree),
  };
}

export async function executorGenerator(host: Tree, schema: Schema) {
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
