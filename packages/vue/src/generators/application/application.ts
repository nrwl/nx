import {
  addProjectConfiguration,
  updateProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  offsetFromRoot,
  runTasksInSerial,
  Tree,
  readProjectConfiguration,
} from '@nx/devkit';
import * as path from 'path';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { vueInitGenerator } from '../init/init';
import { nxVersion } from '../../utils/versions';
import { viteConfigurationGenerator, vitestGenerator } from '@nx/vite';
import { createTsConfig } from '../../utils/create-ts-config';
import { getRelativePathToRootTsConfig } from '@nx/js';

export async function applicationGenerator(
  tree: Tree,
  _options: Schema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const options = await normalizeOptions(tree, _options);

  const initTask = await vueInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(initTask);

  addProjectConfiguration(tree, options.name, {
    root: options.appProjectRoot,
    projectType: 'application',
    sourceRoot: `${options.appProjectRoot}/src`,
    targets: {},
  });

  generateFiles(
    tree,
    path.join(__dirname, 'files/common'),
    options.appProjectRoot,
    {
      ...options,
      offsetFromRoot: offsetFromRoot(options.appProjectRoot),
      title: options.projectName,
    }
  );

  createTsConfig(
    tree,
    options.appProjectRoot,
    'app',
    options,
    getRelativePathToRootTsConfig(tree, options.appProjectRoot)
  );

  // Set up build target (and test target if using vitest)
  const viteTask = await viteConfigurationGenerator(tree, {
    uiFramework: 'vue',
    project: options.name,
    newProject: true,
    inSourceTests: options.inSourceTests,
    includeVitest: options.unitTestRunner === 'vitest',
    skipFormat: true,
    testEnvironment: 'jsdom',
  });
  tasks.push(viteTask);

  // Set up test target
  if (options.unitTestRunner === 'jest') {
    const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
      '@nx/jest',
      nxVersion
    );
    const jestTask = await configurationGenerator(tree, {
      project: options.name,
      skipFormat: true,
      testEnvironment: 'jsdom',
    });
    tasks.push(jestTask);
  }

  // Update build to skip type checking since tsc won't work on .vue files.
  // Need to use vue-tsc instead.
  const projectConfig = readProjectConfiguration(tree, options.name);
  projectConfig.targets.build.options.skipTypeCheck = true;
  updateProjectConfiguration(tree, options.name, projectConfig);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
