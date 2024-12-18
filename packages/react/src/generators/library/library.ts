import { relative } from 'path';
import {
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
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
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { ensureProjectIsExcludedFromPluginRegistrations } from '@nx/js/src/utils/typescript/plugin';

export async function libraryGenerator(host: Tree, schema: Schema) {
  return await libraryGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function libraryGeneratorInternal(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(host, schema);
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
    skipFormat: true,
  });
  tasks.push(initTask);

  if (options.isUsingTsSolutionConfig) {
    const sourceEntry =
      options.bundler === 'none'
        ? options.js
          ? './src/index.js'
          : './src/index.ts'
        : undefined;
    writeJson(host, `${options.projectRoot}/package.json`, {
      name: options.importPath,
      version: '0.0.1',
      main: sourceEntry,
      types: sourceEntry,
      nx: {
        name: options.importPath === options.name ? undefined : options.name,
        projectType: 'library',
        sourceRoot: `${options.projectRoot}/src`,
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
    });
  } else {
    addProjectConfiguration(host, options.name, {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'library',
      tags: options.parsedTags,
      targets: {},
    });
  }

  createFiles(host, options);

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

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
  } else if (options.bundler === 'none' && options.addPlugin) {
    const nxJson = readNxJson(host);
    ensureProjectIsExcludedFromPluginRegistrations(nxJson, options.projectRoot);
    updateNxJson(host, nxJson);
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
      compiler: options.compiler,
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
        imports: [
          options.compiler === 'swc'
            ? `import react from '@vitejs/plugin-react-swc'`
            : `import react from '@vitejs/plugin-react'`,
        ],
        plugins: ['react()'],
      },
      true
    );
  }

  if (options.component) {
    const relativeCwd = getRelativeCwd();
    const path = joinPathFragments(
      options.projectRoot,
      'src/lib',
      options.fileName
    );
    const componentTask = await componentGenerator(host, {
      path: relativeCwd ? relative(relativeCwd, path) : path,
      style: options.style,
      skipTests:
        options.unitTestRunner === 'none' ||
        (options.unitTestRunner === 'vitest' && options.inSourceTests == true),
      export: true,
      routing: options.routing,
      js: options.js,
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

  if (!options.skipTsConfig && !options.isUsingTsSolutionConfig) {
    addTsConfigPath(host, options.importPath, [
      maybeJs(
        options,
        joinPathFragments(options.projectRoot, './src/index.ts')
      ),
    ]);
  }

  updateTsconfigFiles(
    host,
    options.projectRoot,
    'tsconfig.lib.json',
    {
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
    },
    options.linter === 'eslint'
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined
  );

  if (options.isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(host, `${options.projectRoot}/*`);
  }
  if (!options.skipFormat) {
    await formatFiles(host);
  }

  // Always run install to link packages.
  if (options.isUsingTsSolutionConfig) {
    tasks.push(() => installPackagesTask(host, true));
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
