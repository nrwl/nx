import {
  GeneratorCallback,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  createOrEditViteConfig,
  viteConfigurationGenerator,
  vitestGenerator,
} from '@nx/vite';

import { NormalizedSchema } from '../schema';

export async function addVite(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  // Set up build target (and test target if using vitest)
  const viteTask = await viteConfigurationGenerator(tree, {
    uiFramework: 'none',
    project: options.projectName,
    newProject: true,
    inSourceTests: options.inSourceTests,
    includeVitest: options.unitTestRunner === 'vitest',
    skipFormat: true,
    testEnvironment: 'jsdom',
    addPlugin: options.addPlugin,
  });

  createOrEditViteConfig(
    tree,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: options.unitTestRunner === 'vitest',
      inSourceTests: options.inSourceTests,
      imports: [`import vue from '@vitejs/plugin-vue'`],
      plugins: ['vue()'],
    },
    false
  );

  // Update build to skip type checking since tsc won't work on .vue files.
  // Need to use vue-tsc instead.
  const projectConfig = readProjectConfiguration(tree, options.projectName);
  if (projectConfig.targets?.build?.options) {
    projectConfig.targets.build.options.skipTypeCheck = true;
    updateProjectConfiguration(tree, options.projectName, projectConfig);
  }

  return viteTask;
}

export async function addVitest(tree: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  const vitestTask = await vitestGenerator(tree, {
    uiFramework: 'none',
    project: options.projectName,
    coverageProvider: 'v8',
    inSourceTests: options.inSourceTests,
    skipFormat: true,
    testEnvironment: 'jsdom',
    addPlugin: options.addPlugin,
    runtimeTsconfigFileName: 'tsconfig.app.json',
  });
  tasks.push(vitestTask);

  createOrEditViteConfig(
    tree,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: true,
      inSourceTests: options.inSourceTests,
      imports: [`import vue from '@vitejs/plugin-vue'`],
      plugins: ['vue()'],
    },
    true
  );

  return tasks;
}
