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
} from '@nrwl/devkit';

import { updateRootTsConfig } from '@nrwl/js';

import { nxVersion } from '../../utils/versions';
import componentGenerator from '../component/component';
import initGenerator from '../init/init';
import { Schema } from './schema';
import { updateJestConfigContent } from '../../utils/jest-utils';
import { normalizeOptions } from './lib/normalize-options';
import { addRollupBuildTarget } from './lib/add-rollup-build-target';
import { addLinting } from './lib/add-linting';
import { updateAppRoutes } from './lib/update-app-routes';
import { createFiles } from './lib/create-files';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import { installCommonDependencies } from './lib/install-common-dependencies';
import { setDefaults } from './lib/set-defaults';

export async function libraryGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = normalizeOptions(host, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }
  if (!options.component) {
    options.style = 'none';
  }

  const initTask = await initGenerator(host, {
    ...options,
    e2eTestRunner: 'none',
    skipFormat: true,
    skipBabelConfig: options.bundler === 'vite',
    skipHelperLibs: options.bundler === 'vite',
  });
  tasks.push(initTask);

  addProjectConfiguration(host, options.name, {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'library',
    tags: options.parsedTags,
    targets: {},
  });

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  createFiles(host, options);

  // Set up build target
  if (options.buildable && options.bundler === 'vite') {
    const { viteConfigurationGenerator } = ensurePackage(
      '@nrwl/vite',
      nxVersion
    );
    const viteTask = await viteConfigurationGenerator(host, {
      uiFramework: 'react',
      project: options.name,
      newProject: true,
      includeLib: true,
      inSourceTests: options.inSourceTests,
      includeVitest: options.unitTestRunner === 'vitest',
    });
    tasks.push(viteTask);
  } else if (options.buildable && options.bundler === 'rollup') {
    const rollupTask = await addRollupBuildTarget(host, options);
    tasks.push(rollupTask);
  }

  // Set up test target
  if (options.unitTestRunner === 'jest') {
    const { jestProjectGenerator } = ensurePackage('@nrwl/jest', nxVersion);

    const jestTask = await jestProjectGenerator(host, {
      ...options,
      project: options.name,
      setupFile: 'none',
      supportTsx: true,
      skipSerializers: true,
      compiler: options.compiler,
    });
    tasks.push(jestTask);
    const jestConfigPath = joinPathFragments(
      options.projectRoot,
      options.js ? 'jest.config.js' : 'jest.config.ts'
    );
    if (options.compiler === 'babel' && host.exists(jestConfigPath)) {
      const updatedContent = updateJestConfigContent(
        host.read(jestConfigPath, 'utf-8')
      );
      host.write(jestConfigPath, updatedContent);
    }
  } else if (
    options.unitTestRunner === 'vitest' &&
    options.bundler !== 'vite' // tests are already configured if bundler is vite
  ) {
    const { vitestGenerator } = ensurePackage('@nrwl/vite', nxVersion);
    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'react',
      project: options.name,
      coverageProvider: 'c8',
      inSourceTests: options.inSourceTests,
    });
    tasks.push(vitestTask);
  }

  if (options.component) {
    const componentTask = await componentGenerator(host, {
      name: options.name,
      project: options.name,
      flat: true,
      style: options.style,
      skipTests:
        options.unitTestRunner === 'none' ||
        (options.unitTestRunner === 'vitest' && options.inSourceTests == true),
      export: true,
      routing: options.routing,
      js: options.js,
      pascalCaseFiles: options.pascalCaseFiles,
      inSourceTests: options.inSourceTests,
    });
    tasks.push(componentTask);
  }

  if (options.publishable || options.buildable) {
    updateJson(host, `${options.projectRoot}/package.json`, (json) => {
      json.name = options.importPath;
      return json;
    });
  }

  if (!options.skipPackageJson) {
    const installReactTask = await installCommonDependencies(host, options);
    tasks.push(installReactTask);
  }

  const routeTask = updateAppRoutes(host, options);
  tasks.push(routeTask);
  setDefaults(host, options);

  extractTsConfigBase(host);
  if (!options.skipTsConfig) {
    updateRootTsConfig(host, options);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);
