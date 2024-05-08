import { relative } from 'path';
import {
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { getRelativeCwd } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { addTsConfigPath, initGenerator as jsInitGenerator } from '@nx/js';

import { nxVersion } from '../../utils/versions';
import { maybeJs } from '../../utils/maybe-js';
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
  return await libraryGeneratorInternal(host, {
    addPlugin: false,
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function libraryGeneratorInternal(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = await normalizeOptions(host, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }
  if (!options.component) {
    options.style = 'none';
  }

  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(jsInitTask);

  const initTask = await initGenerator(host, {
    ...options,
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

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  createFiles(host, options);

  // Set up build target
  if (options.buildable && options.bundler === 'vite') {
    const { viteConfigurationGenerator, createOrEditViteConfig } =
      ensurePackage<typeof import('@nx/vite')>('@nx/vite', nxVersion);
    const viteTask = await viteConfigurationGenerator(host, {
      uiFramework: 'react',
      project: options.name,
      newProject: true,
      includeLib: true,
      inSourceTests: options.inSourceTests,
      includeVitest: options.unitTestRunner === 'vitest',
      compiler: options.compiler,
      skipFormat: true,
      testEnvironment: 'jsdom',
      addPlugin: options.addPlugin,
    });
    tasks.push(viteTask);
    createOrEditViteConfig(
      host,
      {
        project: options.name,
        includeLib: true,
        includeVitest: options.unitTestRunner === 'vitest',
        inSourceTests: options.inSourceTests,
        rollupOptionsExternal: [
          "'react'",
          "'react-dom'",
          "'react/jsx-runtime'",
        ],
        imports: [
          options.compiler === 'swc'
            ? `import react from '@vitejs/plugin-react-swc'`
            : `import react from '@vitejs/plugin-react'`,
        ],
        plugins: ['react()'],
      },
      false
    );
  } else if (options.buildable && options.bundler === 'rollup') {
    const rollupTask = await addRollupBuildTarget(host, options);
    tasks.push(rollupTask);
  }

  // Set up test target
  if (options.unitTestRunner === 'jest') {
    const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
      '@nx/jest',
      nxVersion
    );

    const jestTask = await configurationGenerator(host, {
      ...options,
      project: options.name,
      setupFile: 'none',
      supportTsx: true,
      skipSerializers: true,
      compiler: options.compiler,
      skipFormat: true,
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
    const { vitestGenerator, createOrEditViteConfig } = ensurePackage<
      typeof import('@nx/vite')
    >('@nx/vite', nxVersion);
    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'react',
      project: options.name,
      coverageProvider: 'v8',
      inSourceTests: options.inSourceTests,
      skipFormat: true,
      testEnvironment: 'jsdom',
      addPlugin: options.addPlugin,
    });
    tasks.push(vitestTask);
    createOrEditViteConfig(
      host,
      {
        project: options.name,
        includeLib: true,
        includeVitest: true,
        inSourceTests: options.inSourceTests,
        rollupOptionsExternal: [
          "'react'",
          "'react-dom'",
          "'react/jsx-runtime'",
        ],
        imports: [`import react from '@vitejs/plugin-react'`],
        plugins: ['react()'],
      },
      true
    );
  }

  if (options.component) {
    const relativeCwd = getRelativeCwd();
    const name = joinPathFragments(
      options.projectRoot,
      'src/lib',
      options.fileName
    );
    const componentTask = await componentGenerator(host, {
      nameAndDirectoryFormat: 'as-provided',
      name: relativeCwd ? relative(relativeCwd, name) : name,
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
      skipFormat: true,
      globalCss: options.globalCss,
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
    const installReactTask = installCommonDependencies(host, options);
    tasks.push(installReactTask);
  }

  const routeTask = updateAppRoutes(host, options);
  tasks.push(routeTask);
  setDefaults(host, options);

  extractTsConfigBase(host);

  if (!options.skipTsConfig) {
    addTsConfigPath(host, options.importPath, [
      maybeJs(
        options,
        joinPathFragments(options.projectRoot, './src/index.ts')
      ),
    ]);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
