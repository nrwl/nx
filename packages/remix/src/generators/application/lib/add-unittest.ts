import {
  GeneratorCallback,
  Tree,
  ensurePackage,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';
import { updateUnitTestConfig } from './update-unit-test-config';
import { fail } from 'assert';
import { getPackageVersion } from '@nx/remix/src/utils/versions';

/** Add unit test config to the project */
export async function addUnitTest(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback[]> {
  // An extra sanity check
  if (options.unitTestRunner === 'none') {
    fail('Invalid test provider "none" was passed to the add-unittest');
  }

  const tasks: GeneratorCallback[] = [];

  if (options.unitTestRunner === 'vitest') {
    tasks.push(await setupVitest(tree, options));
  } else {
    tasks.push(await setupJest(tree, options));
  }

  const pkgInstallTask = updateUnitTestConfig(
    tree,
    options.projectRoot,
    options.unitTestRunner,
    options.rootProject
  );

  tasks.push(pkgInstallTask);

  return tasks;
}

async function setupVitest(tree: Tree, options: NormalizedSchema) {
  const { vitestGenerator, createOrEditViteConfig } = ensurePackage<
    typeof import('@nx/vite')
  >('@nx/vite', getPackageVersion(tree, 'nx'));
  const vitestTask = await vitestGenerator(tree, {
    uiFramework: 'react',
    project: options.projectName,
    coverageProvider: 'v8',
    inSourceTests: false,
    skipFormat: true,
    testEnvironment: 'jsdom',
    skipViteConfig: true,
    addPlugin: options.addPlugin,
  });
  createOrEditViteConfig(
    tree,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: true,
      testEnvironment: 'jsdom',
      imports: [`import react from '@vitejs/plugin-react';`],
      plugins: [`react()`],
    },
    true,
    undefined,
    true
  );

  return vitestTask;
}

async function setupJest(tree: Tree, options: NormalizedSchema) {
  const { configurationGenerator: jestConfigurationGenerator } = ensurePackage<
    typeof import('@nx/jest')
  >('@nx/jest', getPackageVersion(tree, 'nx'));
  const jestTask = await jestConfigurationGenerator(tree, {
    project: options.projectName,
    setupFile: 'none',
    supportTsx: true,
    skipSerializers: false,
    skipPackageJson: false,
    skipFormat: true,
    addPlugin: options.addPlugin,
  });
  const projectConfig = readProjectConfiguration(tree, options.projectName);
  if (projectConfig.targets['test']?.options) {
    projectConfig.targets['test'].options.passWithNoTests = true;
    updateProjectConfiguration(tree, options.projectName, projectConfig);
  }

  return jestTask;
}
