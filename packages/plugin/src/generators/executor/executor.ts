import {
  readProjectConfiguration,
  names,
  generateFiles,
  updateJson,
  joinPathFragments,
  writeJson,
  readJson,
  ExecutorsJson,
  formatFiles,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import type { Schema } from './schema';
import * as path from 'path';
import { PackageJson } from 'nx/src/utils/package-json';
import pluginLintCheckGenerator from '../lint-checks/generator';
import { nxVersion } from '../../utils/versions';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { relative } from 'path';

interface NormalizedSchema extends Schema {
  className: string;
  propertyName: string;
  projectRoot: string;
  filePath: string;
  directory: string;
  project: string;
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, path.join(__dirname, './files/executor'), options.path, {
    ...options,
  });

  if (options.unitTestRunner === 'none') {
    host.delete(joinPathFragments(options.path, `executor.spec.ts`));
  }
}

function addHasherFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, path.join(__dirname, './files/hasher'), options.path, {
    ...options,
  });

  if (options.unitTestRunner === 'none') {
    host.delete(joinPathFragments(options.path, 'hasher.spec.ts'));
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
      implementation: `./${joinPathFragments(
        relative(options.projectRoot, options.path),
        'executor'
      )}`,
      schema: `./${joinPathFragments(
        relative(options.projectRoot, options.path),
        'schema.json'
      )}`,
      description: options.description,
    };
    if (options.includeHasher) {
      executors[options.name].hasher = `./${joinPathFragments(
        relative(options.projectRoot, options.path),
        'hasher'
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
  const { project, artifactName, filePath, directory } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      name: options.name,
      path: options.path,
      fileName: 'executor',
    });

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
    className,
    propertyName,
    description,
    projectRoot,
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
