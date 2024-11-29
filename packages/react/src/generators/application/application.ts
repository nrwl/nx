import { extraEslintDependencies } from '../../utils/lint';
import { NormalizedSchema, Schema } from './schema';
import { createApplicationFiles } from './lib/create-application-files';
import { updateSpecConfig } from './lib/update-jest-config';
import { normalizeOptions } from './lib/normalize-options';
import { addProject } from './lib/add-project';
import { addJest } from './lib/add-jest';
import { addRouting } from './lib/add-routing';
import { setDefaults } from './lib/set-defaults';
import { addStyledModuleDependencies } from '../../rules/add-styled-dependencies';
import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  readNxJson,
  runTasksInSerial,
  stripIndents,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import reactInitGenerator from '../init/init';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import {
  babelLoaderVersion,
  nxRspackVersion,
  nxVersion,
} from '../../utils/versions';
import { installCommonDependencies } from './lib/install-common-dependencies';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import * as pc from 'picocolors';
import { showPossibleWarnings } from './lib/show-possible-warnings';
import { addE2e } from './lib/add-e2e';
import {
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';
import { updateTsconfigFiles } from '../../utils/ts-solution';

async function addLinting(host: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  if (options.linter === Linter.EsLint) {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
      skipPackageJson: options.skipPackageJson,
      addPlugin: options.addPlugin,
    });
    tasks.push(lintTask);

    if (isEslintConfigSupported(host)) {
      if (useFlatConfig(host)) {
        addPredefinedConfigToFlatLintConfig(
          host,
          options.appProjectRoot,
          'flat/react'
        );
        // Add an empty rules object to users know how to add/override rules
        addOverrideToLintConfig(host, options.appProjectRoot, {
          files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
          rules: {},
        });
      } else {
        const addExtendsTask = addExtendsToLintConfig(
          host,
          options.appProjectRoot,
          { name: 'plugin:@nx/react', needCompatFixup: true }
        );
        tasks.push(addExtendsTask);
      }
    }

    if (!options.skipPackageJson) {
      const installTask = addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        extraEslintDependencies.devDependencies
      );
      const addSwcTask = addSwcDependencies(host);
      tasks.push(installTask, addSwcTask);
    }
  }
  return runTasksInSerial(...tasks);
}

export async function applicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await applicationGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function applicationGeneratorInternal(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const tasks = [];

  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
    addTsPlugin:
      process.env.NX_ADD_PLUGINS !== 'false' &&
      process.env.NX_ADD_TS_PLUGIN !== 'false',
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(host, schema);
  showPossibleWarnings(host, options);

  const initTask = await reactInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  tasks.push(initTask);

  if (!options.addPlugin) {
    const nxJson = readNxJson(host);
    nxJson.targetDefaults ??= {};
    if (!Object.keys(nxJson.targetDefaults).includes('build')) {
      nxJson.targetDefaults.build = {
        cache: true,
        dependsOn: ['^build'],
      };
    } else if (!nxJson.targetDefaults.build.dependsOn) {
      nxJson.targetDefaults.build.dependsOn = ['^build'];
    }
    updateNxJson(host, nxJson);
  }

  if (options.bundler === 'webpack') {
    const { webpackInitGenerator } = ensurePackage<
      typeof import('@nx/webpack')
    >('@nx/webpack', nxVersion);
    const webpackInitTask = await webpackInitGenerator(host, {
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
      addPlugin: options.addPlugin,
    });
    tasks.push(webpackInitTask);
    if (!options.skipPackageJson) {
      const { ensureDependencies } = await import(
        '@nx/webpack/src/utils/ensure-dependencies'
      );
      tasks.push(ensureDependencies(host, { uiFramework: 'react' }));
    }
  } else if (options.bundler === 'rspack') {
    const { rspackInitGenerator } = ensurePackage(
      '@nx/rspack',
      nxRspackVersion
    );
    const rspackInitTask = await rspackInitGenerator(host, {
      ...options,
      addPlugin: false,
      skipFormat: true,
    });
    tasks.push(rspackInitTask);
  }

  if (!options.rootProject) {
    extractTsConfigBase(host);
  }

  await createApplicationFiles(host, options);
  addProject(host, options);

  if (options.style === 'tailwind') {
    const twTask = await setupTailwindGenerator(host, {
      project: options.projectName,
    });
    tasks.push(twTask);
  }

  if (options.bundler === 'vite') {
    const { createOrEditViteConfig, viteConfigurationGenerator } =
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
      uiFramework: 'react',
      project: options.projectName,
      newProject: true,
      includeVitest: options.unitTestRunner === 'vitest',
      inSourceTests: options.inSourceTests,
      compiler: options.compiler,
      skipFormat: true,
      addPlugin: options.addPlugin,
      projectType: 'application',
    });
    tasks.push(viteTask);
    createOrEditViteConfig(
      host,
      {
        project: options.projectName,
        includeLib: false,
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
  }

  if (options.bundler !== 'vite' && options.unitTestRunner === 'vitest') {
    const { createOrEditViteConfig, vitestGenerator } = ensurePackage<
      typeof import('@nx/vite')
    >('@nx/vite', nxVersion);

    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'react',
      coverageProvider: 'v8',
      project: options.projectName,
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

  if (
    (options.bundler === 'vite' || options.unitTestRunner === 'vitest') &&
    options.inSourceTests
  ) {
    host.delete(
      joinPathFragments(
        options.appProjectRoot,
        `src/app/${options.fileName}.spec.tsx`
      )
    );
  }

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  const e2eTask = await addE2e(host, options);
  tasks.push(e2eTask);

  if (options.unitTestRunner === 'jest') {
    const jestTask = await addJest(host, options);
    tasks.push(jestTask);
  }

  // Handle tsconfig.spec.json for jest or vitest
  updateSpecConfig(host, options);
  const stylePreprocessorTask = installCommonDependencies(host, options);
  tasks.push(stylePreprocessorTask);
  const styledTask = addStyledModuleDependencies(host, options);
  tasks.push(styledTask);
  const routingTask = addRouting(host, options);
  tasks.push(routingTask);
  setDefaults(host, options);

  if (options.bundler === 'rspack' && options.style === 'styled-jsx') {
    logger.warn(
      `${pc.bold('styled-jsx')} is not supported by ${pc.bold(
        'Rspack'
      )}. We've added ${pc.bold(
        'babel-loader'
      )} to your project, but using babel will slow down your build.`
    );

    tasks.push(
      addDependenciesToPackageJson(
        host,
        {},
        { 'babel-loader': babelLoaderVersion }
      )
    );

    host.write(
      joinPathFragments(options.appProjectRoot, 'rspack.config.js'),
      stripIndents`
        const { composePlugins, withNx, withReact } = require('@nx/rspack');
        module.exports = composePlugins(withNx(), withReact(), (config) => {
          config.module.rules.push({
            test: /\\.[jt]sx$/i,
            use: [
              {
                loader: 'babel-loader',
                options: {
                  presets: ['@babel/preset-typescript'],
                  plugins: ['styled-jsx/babel'],
                },
              },
            ],
          });
          return config;
        });
        `
    );
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  updateTsconfigFiles(host, options.appProjectRoot, 'tsconfig.app.json');

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
