import {
  addProjectConfiguration,
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';
import { nxVersion } from '../../utils/versions';
import initGenerator from '../init/init';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { addLinting } from '../../utils/add-linting';
import { createFiles } from './lib/create-files';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import componentGenerator from '../component/component';

export async function libraryGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = await normalizeOptions(host, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  const initTask = await initGenerator(host, {
    ...options,
    e2eTestRunner: 'none',
    skipFormat: true,
  });
  tasks.push(initTask);

  addProjectConfiguration(host, options.name, {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'library',
    tags: options.parsedTags,
    targets: {},
  });

  const lintTask = await addLinting(host, options, 'lib');
  tasks.push(lintTask);

  createFiles(host, options);

  // Set up build target
  if (options.bundler === 'vite') {
    const { viteConfigurationGenerator, createOrEditViteConfig } =
      ensurePackage<typeof import('@nx/vite')>('@nx/vite', nxVersion);
    const viteTask = await viteConfigurationGenerator(host, {
      uiFramework: 'none',
      project: options.name,
      newProject: true,
      includeLib: true,
      inSourceTests: options.inSourceTests,
      includeVitest: options.unitTestRunner === 'vitest',
      skipFormat: true,
      testEnvironment: 'jsdom',
      skipViteConfig: true,
    });
    tasks.push(viteTask);

    const viteConfigCreation = createOrEditViteConfig(
      host,
      {
        project: options.name,
        includeLib: true,
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
  }

  // Set up test target
  if (
    options.unitTestRunner === 'vitest' &&
    options.bundler !== 'vite' // tests are already configured if bundler is vite
  ) {
    const { vitestGenerator, createOrEditViteConfig } = ensurePackage<
      typeof import('@nx/vite')
    >('@nx/vite', nxVersion);
    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'none',
      project: options.name,
      coverageProvider: 'c8',
      inSourceTests: options.inSourceTests,
      skipFormat: true,
      testEnvironment: 'jsdom',
      skipViteConfig: true,
    });
    tasks.push(vitestTask);

    const vitestConfigCreation = createOrEditViteConfig(
      host,
      {
        project: options.name,
        includeLib: true,
        includeVitest: true,
        inSourceTests: options.inSourceTests,
        importLines: [`import vue from '@vitejs/plugin-vue'`],
        plugins: ['vue()'],
      },
      true
    );
    tasks.push((): void => {
      vitestConfigCreation;
    });
  }

  if (options.component) {
    const componentTask = await componentGenerator(host, {
      name: options.fileName,
      project: options.name,
      flat: true,
      skipTests:
        options.unitTestRunner === 'none' ||
        (options.unitTestRunner === 'vitest' && options.inSourceTests == true),
      export: true,
      routing: options.routing,
      js: options.js,
      pascalCaseFiles: options.pascalCaseFiles,
      inSourceTests: options.inSourceTests,
      skipFormat: true,
    });
    tasks.push(componentTask);
  }

  if (options.publishable || options.bundler !== 'none') {
    updateJson(host, `${options.projectRoot}/package.json`, (json) => {
      json.name = options.importPath;
      return json;
    });
  }

  // TODO(katerina): tbd
  // const routeTask = updateAppRoutes(host, options);
  // tasks.push(routeTask);
  // setDefaults(host, options);

  extractTsConfigBase(host);

  if (!options.skipTsConfig) {
    addTsConfigPath(host, options.importPath, [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ]);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);
