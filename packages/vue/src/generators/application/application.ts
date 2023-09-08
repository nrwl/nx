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
import { createOrEditViteConfig, viteConfigurationGenerator } from '@nx/vite';
import { createTsConfig } from '../../utils/create-ts-config';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { addLinting } from '../../utils/add-linting';

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

  // TODO: to be fixed
  const lintTask = await addLinting(
    tree,
    {
      js: options.js,
      name: options.projectName,
      projectRoot: options.appProjectRoot,
      linter: options.linter ?? 'eslint',
      unitTestRunner: options.unitTestRunner as any,
      setParserOptionsProject: options.setParserOptionsProject,
    } as any,
    'app'
  );
  tasks.push(lintTask);

  // Set up build target (and test target if using vitest)
  const viteTask = await viteConfigurationGenerator(tree, {
    uiFramework: 'none',
    project: options.name,
    newProject: true,
    inSourceTests: options.inSourceTests,
    includeVitest: options.unitTestRunner === 'vitest',
    skipFormat: true,
    testEnvironment: 'jsdom',
    skipViteConfig: true,
  });
  tasks.push(viteTask);

  const viteConfigCreation = createOrEditViteConfig(
    tree,
    {
      project: options.name,
      includeLib: false,
      includeVitest: options.unitTestRunner === 'vitest',
      inSourceTests: options.inSourceTests,
      importLines: [`import vue from '@vitejs/plugin-vue'`],
      plugins: ['vue()'],
    },
    false
  );
  tasks.push((): void => {
    viteConfigCreation;
  });

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
