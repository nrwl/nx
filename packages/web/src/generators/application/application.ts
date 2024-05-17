import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  writeJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { swcCoreVersion } from '@nx/js/src/utils/versions';
import {
  nxVersion,
  swcLoaderVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { webInitGenerator } from '../init/init';
import { Schema } from './schema';

import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { addProject } from './lib/add-project';
import { setupBundler } from './lib/setup-bundler';
import { createApplicationFiles } from './lib/create-application-files';
import { setDefaults } from './lib/set-defaults';
import { normalizeOptions } from './lib/normalize-options';

export async function applicationGenerator(host: Tree, schema: Schema) {
  return await applicationGeneratorInternal(host, {
    addPlugin: false,
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function applicationGeneratorInternal(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);

  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(host, {
    js: false,
    skipFormat: true,
  });
  tasks.push(jsInitTask);
  const webTask = await webInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  tasks.push(webTask);

  await addProject(host, options);

  if (options.bundler !== 'vite') {
    await setupBundler(host, options);
  }

  createApplicationFiles(host, options);

  if (options.bundler === 'vite') {
    const { viteConfigurationGenerator, createOrEditViteConfig } =
      ensurePackage<typeof import('@nx/vite')>('@nx/vite', nxVersion);
    // We recommend users use `import.meta.env.MODE` and other variables in their code to differentiate between production and development.
    // See: https://vitejs.dev/guide/env-and-mode.html
    if (
      host.exists(joinPathFragments(options.appProjectRoot, 'src/environments'))
    ) {
      host.delete(
        joinPathFragments(options.appProjectRoot, 'src/environments')
      );
    }

    const viteTask = await viteConfigurationGenerator(host, {
      uiFramework: 'none',
      project: options.projectName,
      newProject: true,
      includeVitest: options.unitTestRunner === 'vitest',
      inSourceTests: options.inSourceTests,
      skipFormat: true,
      addPlugin: options.addPlugin,
    });
    tasks.push(viteTask);
    createOrEditViteConfig(
      host,
      {
        project: options.projectName,
        includeLib: false,
        includeVitest: options.unitTestRunner === 'vitest',
        inSourceTests: options.inSourceTests,
      },
      false
    );
  }

  if (options.bundler !== 'vite' && options.unitTestRunner === 'vitest') {
    const { vitestGenerator, createOrEditViteConfig } = ensurePackage<
      typeof import('@nx/vite')
    >('@nx/vite', nxVersion);
    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'none',
      project: options.projectName,
      coverageProvider: 'v8',
      inSourceTests: options.inSourceTests,
      skipFormat: true,
      addPlugin: options.addPlugin,
    });
    tasks.push(vitestTask);
    createOrEditViteConfig(
      host,
      {
        project: options.projectName,
        includeLib: false,
        includeVitest: true,
        inSourceTests: options.inSourceTests,
      },
      true
    );
  }

  if (
    (options.bundler === 'vite' || options.unitTestRunner === 'vitest') &&
    options.inSourceTests
  ) {
    host.delete(
      joinPathFragments(options.appProjectRoot, `src/app/app.element.spec.ts`)
    );
  }

  if (options.linter === 'eslint') {
    const { lintProjectGenerator } = ensurePackage<typeof import('@nx/eslint')>(
      '@nx/eslint',
      nxVersion
    );
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      setParserOptionsProject: options.setParserOptionsProject,
      addPlugin: options.addPlugin,
    });
    tasks.push(lintTask);
  }

  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      projectType: 'application',
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });
    const cypressTask = await configurationGenerator(host, {
      ...options,
      project: options.e2eProjectName,
      devServerTarget: `${options.projectName}:${options.e2eWebServerTarget}`,
      baseUrl: options.e2eWebServerAddress,
      directory: 'src',
      skipFormat: true,
    });
    tasks.push(cypressTask);
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator: playwrightConfigGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', nxVersion);
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      projectType: 'application',
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });
    const playwrightTask = await playwrightConfigGenerator(host, {
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: false,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerCommand: `${getPackageManagerCommand().exec} nx ${
        options.e2eWebServerTarget
      } ${options.name}`,
      webServerAddress: options.e2eWebServerAddress,
      addPlugin: options.addPlugin,
    });
    tasks.push(playwrightTask);
  }
  if (options.unitTestRunner === 'jest') {
    const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
      '@nx/jest',
      nxVersion
    );
    const jestTask = await configurationGenerator(host, {
      project: options.projectName,
      skipSerializers: true,
      setupFile: 'web-components',
      compiler: options.compiler,
      skipFormat: true,
      addPlugin: options.addPlugin,
    });
    tasks.push(jestTask);
  }

  if (options.compiler === 'swc') {
    writeJson(host, joinPathFragments(options.appProjectRoot, '.swcrc'), {
      jsc: {
        parser: {
          syntax: 'typescript',
        },
        target: 'es2016',
      },
    });
    const installTask = addDependenciesToPackageJson(
      host,
      {},
      { '@swc/core': swcCoreVersion, 'swc-loader': swcLoaderVersion }
    );
    tasks.push(installTask);
  } else {
    writeJson(host, joinPathFragments(options.appProjectRoot, '.babelrc'), {
      presets: ['@nx/js/babel'],
    });
  }

  setDefaults(host, options);

  tasks.push(
    addDependenciesToPackageJson(
      host,
      { tslib: tsLibVersion },
      { '@types/node': typesNodeVersion }
    )
  );

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
