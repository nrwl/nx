import {
  readProjectConfiguration,
  names,
  convertNxGenerator,
  generateFiles,
  updateJson,
  getWorkspaceLayout,
  joinPathFragments,
  writeJson,
  readJson,
  ExecutorsJson,
} from '@nrwl/devkit';
import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import * as path from 'path';
import { PackageJson } from 'nx/src/utils/package-json';

interface NormalizedSchema extends Schema {
  fileName: string;
  className: string;
  propertyName: string;
  projectRoot: string;
  projectSourceRoot: string;
  npmScope: string;
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    path.join(__dirname, './files/executor'),
    `${options.projectSourceRoot}/executors`,
    {
      ...options,
      tmpl: '',
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(
      joinPathFragments(
        options.projectSourceRoot,
        'executors',
        options.fileName,
        `executor.spec.ts`
      )
    );
  }
}

function addHasherFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    path.join(__dirname, './files/hasher'),
    `${options.projectSourceRoot}/executors`,
    {
      ...options,
      tmpl: '',
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(
      joinPathFragments(
        options.projectSourceRoot,
        'executors',
        options.fileName,
        'hasher.spec.ts'
      )
    );
  }
}

function createExecutorsJson(host: Tree, options: NormalizedSchema) {
  updateJson<PackageJson>(
    host,
    joinPathFragments(options.projectRoot, 'package.json'),
    (json) => {
      json.executors ??= 'executors.json';
      return json;
    }
  );
  writeJson<ExecutorsJson>(
    host,
    joinPathFragments(options.projectRoot, 'executors.json'),
    {
      executors: {},
    }
  );
}

function updateExecutorJson(host: Tree, options: NormalizedSchema) {
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
    createExecutorsJson(host, options);
  }

  return updateJson(host, executorsPath, (json) => {
    let executors = json.executors ?? json.builders;
    executors ||= {};
    executors[options.name] = {
      implementation: `./src/executors/${options.fileName}/executor`,
      schema: `./src/executors/${options.fileName}/schema.json`,
      description: options.description,
    };
    if (options.includeHasher) {
      executors[
        options.name
      ].hasher = `./src/executors/${options.fileName}/hasher`;
    }
    json.executors = executors;

    return json;
  });
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { npmScope } = getWorkspaceLayout(host);
  const { fileName, className, propertyName } = names(options.name);

  const { root: projectRoot, sourceRoot: projectSourceRoot } =
    readProjectConfiguration(host, options.project);

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} executor`;
  }

  return {
    ...options,
    fileName,
    className,
    propertyName,
    description,
    projectRoot,
    projectSourceRoot,
    npmScope,
  };
}

export async function executorGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  addFiles(host, options);
  if (options.includeHasher) {
    addHasherFiles(host, options);
  }

  updateExecutorJson(host, options);
}

export default executorGenerator;
export const executorSchematic = convertNxGenerator(executorGenerator);
