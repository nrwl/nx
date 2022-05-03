import {
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import * as path from 'path';

import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectName: string;
  pluginPropertyName: string;
  npmScope: string;
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { npmScope, appsDir } = getWorkspaceLayout(host);

  const projectName = `${options.pluginName}-e2e`;
  const projectRoot = options.projectDirectory
    ? joinPathFragments(appsDir, `${options.projectDirectory}-e2e`)
    : joinPathFragments(appsDir, projectName);
  const pluginPropertyName = names(options.pluginName).propertyName;

  return {
    ...options,
    projectName,
    pluginPropertyName,
    projectRoot,
    npmScope,
  };
}

function validatePlugin(host: Tree, pluginName: string) {
  try {
    readProjectConfiguration(host, pluginName);
  } catch {
    throw new Error(`Project name "${pluginName}" doesn't not exist.`);
  }
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, path.join(__dirname, './files'), options.projectRoot, {
    ...options,
    tmpl: '',
    rootTsConfigPath: getRelativePathToRootTsConfig(host, options.projectRoot),
  });
}

function updateWorkspaceConfiguration(host: Tree, options: NormalizedSchema) {
  addProjectConfiguration(
    host,
    options.projectName,
    {
      root: options.projectRoot,
      projectType: 'application',
      sourceRoot: `${options.projectRoot}/src`,
      targets: {
        e2e: {
          executor: '@nrwl/nx-plugin:e2e',
          options: { target: `${options.pluginName}:build` },
        },
      },
      tags: [],
      implicitDependencies: [options.pluginName],
    },
    options.standaloneConfig
  );
}

async function addJest(host: Tree, options: NormalizedSchema) {
  await jestProjectGenerator(host, {
    project: options.projectName,
    setupFile: 'none',
    supportTsx: false,
    skipSerializers: true,
  });

  const project = readProjectConfiguration(host, options.projectName);
  const testOptions = project.targets.test.options;
  const e2eOptions = project.targets.e2e.options;
  project.targets.e2e.options = {
    ...e2eOptions,
    jestConfig: testOptions.jestConfig,
  };

  // remove the jest build target
  delete project.targets.test;

  updateProjectConfiguration(host, options.projectName, project);
}

export async function e2eProjectGenerator(host: Tree, schema: Schema) {
  validatePlugin(host, schema.pluginName);
  const options = normalizeOptions(host, schema);
  addFiles(host, options);
  updateWorkspaceConfiguration(host, options);
  await addJest(host, options);

  await formatFiles(host);
}

export default e2eProjectGenerator;
export const e2eProjectSchematic = convertNxGenerator(e2eProjectGenerator);
