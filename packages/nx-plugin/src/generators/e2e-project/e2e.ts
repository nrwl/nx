import type { Tree } from '@nrwl/devkit';
import {
  addProjectConfiguration,
  convertNxGenerator,
  extractLayoutDirectory,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { getRelativePathToRootTsConfig } from '@nrwl/js';
import * as path from 'path';

import type { Schema } from './schema';
import { Linter, lintProjectGenerator } from '@nrwl/linter';

interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectName: string;
  pluginPropertyName: string;
  npmScope: string;
  linter: Linter;
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.projectDirectory
  );
  const { npmScope, appsDir: defaultAppsDir } = getWorkspaceLayout(host);
  const appsDir = layoutDirectory ?? defaultAppsDir;

  const projectName = `${options.pluginName}-e2e`;
  const projectRoot = projectDirectory
    ? joinPathFragments(appsDir, `${projectDirectory}-e2e`)
    : joinPathFragments(appsDir, projectName);
  const pluginPropertyName = names(options.pluginName).propertyName;

  return {
    ...options,
    minimal: options.minimal ?? false,
    projectName,
    linter: options.linter ?? Linter.EsLint,
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
  addProjectConfiguration(host, options.projectName, {
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
  });
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

async function addLintingToApplication(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const lintTask = await lintProjectGenerator(tree, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.projectRoot}/**/*.ts`],
    unitTestRunner: 'jest',
    skipFormat: true,
    setParserOptionsProject: false,
  });

  return lintTask;
}

export async function e2eProjectGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  validatePlugin(host, schema.pluginName);
  const options = normalizeOptions(host, schema);
  addFiles(host, options);
  updateWorkspaceConfiguration(host, options);
  await addJest(host, options);

  if (options.linter !== Linter.None) {
    const lintTask = await addLintingToApplication(host, {
      ...options,
    });
    tasks.push(lintTask);
  }

  await formatFiles(host);

  return runTasksInSerial(...tasks);
}

export default e2eProjectGenerator;
export const e2eProjectSchematic = convertNxGenerator(e2eProjectGenerator);
