import {
  readProjectConfiguration,
  names,
  convertNxGenerator,
  generateFiles,
  updateJson,
  getWorkspaceLayout,
  joinPathFragments,
} from '@nrwl/devkit';
import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import * as path from 'path';

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

function updateExecutorJson(host: Tree, options: NormalizedSchema) {
  let executorPath: string;
  if (host.exists(path.join(options.projectRoot, 'executors.json'))) {
    executorPath = path.join(options.projectRoot, 'executors.json');
  } else {
    executorPath = path.join(options.projectRoot, 'builders.json');
  }

  return updateJson(host, executorPath, (json) => {
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
