import {
  GeneratorCallback,
  Tree,
  ensurePackage,
  runTasksInSerial,
} from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addVite(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];

  // Batch vite/vitest tmp installs up front. When both are needed for a
  // non-vite bundler with vitest, this collapses two tmp installs into one.
  const needsVite =
    options.bundler === 'vite' || options.unitTestRunner === 'vitest';
  const needsVitest =
    options.unitTestRunner === 'vitest' && options.bundler !== 'vite';
  const packagesToEnsure: Record<string, string> = {};
  if (needsVite) {
    packagesToEnsure['@nx/vite'] = nxVersion;
  }
  if (needsVitest) {
    packagesToEnsure['@nx/vitest'] = nxVersion;
  }
  ensurePackage(packagesToEnsure);

  // Set up build target
  if (options.bundler === 'vite') {
    const { viteConfigurationGenerator, createOrEditViteConfig } =
      require('@nx/vite') as typeof import('@nx/vite');
    const viteTask = await viteConfigurationGenerator(tree, {
      uiFramework: 'none',
      project: options.projectName,
      newProject: true,
      includeLib: true,
      inSourceTests: options.inSourceTests,
      includeVitest: options.unitTestRunner === 'vitest',
      skipFormat: true,
      testEnvironment: 'jsdom',
      addPlugin: options.addPlugin,
    });
    tasks.push(viteTask);

    createOrEditViteConfig(
      tree,
      {
        project: options.projectName,
        includeLib: true,
        includeVitest: options.unitTestRunner === 'vitest',
        inSourceTests: options.inSourceTests,
        imports: [`import vue from '@vitejs/plugin-vue'`],
        plugins: ['vue()'],
        useEsmExtension: true,
      },
      false
    );
  }

  // Set up test target
  if (
    options.unitTestRunner === 'vitest' &&
    options.bundler !== 'vite' // tests are already configured if bundler is vite
  ) {
    const { createOrEditViteConfig } =
      require('@nx/vite') as typeof import('@nx/vite');
    const { configurationGenerator } = await import('@nx/vitest/generators');
    const vitestTask = await configurationGenerator(tree, {
      uiFramework: 'vue',
      project: options.projectName,
      coverageProvider: 'v8',
      inSourceTests: options.inSourceTests,
      skipFormat: true,
      testEnvironment: 'jsdom',
      addPlugin: options.addPlugin,
      runtimeTsconfigFileName: 'tsconfig.lib.json',
    });
    tasks.push(vitestTask);

    createOrEditViteConfig(
      tree,
      {
        project: options.projectName,
        includeLib: true,
        includeVitest: true,
        inSourceTests: options.inSourceTests,
        imports: [`import vue from '@vitejs/plugin-vue'`],
        plugins: ['vue()'],
        useEsmExtension: true,
      },
      true
    );
  }

  return runTasksInSerial(...tasks);
}
