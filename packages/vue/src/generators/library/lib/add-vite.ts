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
  // Set up build target
  if (options.bundler === 'vite') {
    const { viteConfigurationGenerator, createOrEditViteConfig } =
      ensurePackage<typeof import('@nx/vite')>('@nx/vite', nxVersion);
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
      },
      false
    );
  }

  // Set up test target
  if (
    options.unitTestRunner === 'vitest' &&
    options.bundler !== 'vite' // tests are already configured if bundler is vite
  ) {
    const { createOrEditViteConfig } = ensurePackage<typeof import('@nx/vite')>(
      '@nx/vite',
      nxVersion
    );
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/vitest')
    >('@nx/vitest', nxVersion);
    const vitestTask = await configurationGenerator(tree, {
      uiFramework: 'none',
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
      },
      true
    );
  }

  return runTasksInSerial(...tasks);
}
