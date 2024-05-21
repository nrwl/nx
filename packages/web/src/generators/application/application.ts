import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  names,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  TargetConfiguration,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import {
  getRelativePathToRootTsConfig,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import { swcCoreVersion } from '@nx/js/src/utils/versions';
import type { Linter } from '@nx/eslint';
import { join } from 'path';
import {
  nxVersion,
  swcLoaderVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { webInitGenerator } from '../init/init';
import { Schema } from './schema';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import { hasWebpackPlugin } from '../../utils/has-webpack-plugin';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { VitePluginOptions } from '@nx/vite/src/plugins/plugin';
import { WebpackPluginOptions } from '@nx/webpack/src/plugins/plugin';

interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  e2eWebServerAddress: string;
  e2eWebServerTarget: string;
  e2ePort: number;
  parsedTags: string[];
}

function createApplicationFiles(tree: Tree, options: NormalizedSchema) {
  if (options.bundler === 'vite') {
    generateFiles(
      tree,
      join(__dirname, './files/app-vite'),
      options.appProjectRoot,
      {
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.appProjectRoot),
        rootTsConfigPath: getRelativePathToRootTsConfig(
          tree,
          options.appProjectRoot
        ),
      }
    );
  } else {
    generateFiles(
      tree,
      join(__dirname, './files/app-webpack'),
      options.appProjectRoot,
      {
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.appProjectRoot),
        rootTsConfigPath: getRelativePathToRootTsConfig(
          tree,
          options.appProjectRoot
        ),
        webpackPluginOptions: hasWebpackPlugin(tree)
          ? {
              compiler: options.compiler,
              target: 'web',
              outputPath: joinPathFragments(
                'dist',
                options.appProjectRoot != '.'
                  ? options.appProjectRoot
                  : options.projectName
              ),
              tsConfig: './tsconfig.app.json',
              main: './src/main.ts',
              assets: ['./src/favicon.ico', './src/assets'],
              index: './src/index.html',
              baseHref: '/',
              styles: [`./src/styles.${options.style}`],
            }
          : null,
      }
    );
    if (options.unitTestRunner === 'none') {
      tree.delete(
        join(options.appProjectRoot, './src/app/app.element.spec.ts')
      );
    }
  }
  updateJson(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
    (json) => {
      return {
        ...json,
        compilerOptions: {
          ...(json.compilerOptions || {}),
          strict: options.strict,
        },
      };
    }
  );
}

async function setupBundler(tree: Tree, options: NormalizedSchema) {
  const main = joinPathFragments(options.appProjectRoot, 'src/main.ts');
  const tsConfig = joinPathFragments(
    options.appProjectRoot,
    'tsconfig.app.json'
  );
  const assets = [
    joinPathFragments(options.appProjectRoot, 'src/favicon.ico'),
    joinPathFragments(options.appProjectRoot, 'src/assets'),
  ];

  if (options.bundler === 'webpack') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/webpack')
    >('@nx/webpack', nxVersion);
    await configurationGenerator(tree, {
      target: 'web',
      project: options.projectName,
      main,
      tsConfig,
      compiler: options.compiler ?? 'babel',
      devServer: true,
      webpackConfig: joinPathFragments(
        options.appProjectRoot,
        'webpack.config.js'
      ),
      skipFormat: true,
      addPlugin: options.addPlugin,
    });
    const project = readProjectConfiguration(tree, options.projectName);
    if (project.targets.build) {
      const prodConfig = project.targets.build.configurations.production;
      const buildOptions = project.targets.build.options;
      buildOptions.assets = assets;
      buildOptions.index = joinPathFragments(
        options.appProjectRoot,
        'src/index.html'
      );
      buildOptions.baseHref = '/';
      buildOptions.styles = [
        joinPathFragments(
          options.appProjectRoot,
          `src/styles.${options.style}`
        ),
      ];
      // We can delete that, because this projest is an application
      // and applications have a .babelrc file in their root dir.
      // So Nx will find it and use it
      delete buildOptions.babelUpwardRootMode;
      buildOptions.scripts = [];
      prodConfig.fileReplacements = [
        {
          replace: joinPathFragments(
            options.appProjectRoot,
            `src/environments/environment.ts`
          ),
          with: joinPathFragments(
            options.appProjectRoot,
            `src/environments/environment.prod.ts`
          ),
        },
      ];
      prodConfig.optimization = true;
      prodConfig.outputHashing = 'all';
      prodConfig.sourceMap = false;
      prodConfig.namedChunks = false;
      prodConfig.extractLicenses = true;
      prodConfig.vendorChunk = false;
      updateProjectConfiguration(tree, options.projectName, project);
    }
    // TODO(jack): Flush this out... no bundler should be possible for web but the experience isn't holistic due to missing features (e.g. writing index.html).
  } else if (options.bundler === 'none') {
    const project = readProjectConfiguration(tree, options.projectName);
    addBuildTargetDefaults(tree, `@nx/js:${options.compiler}`);
    project.targets.build = {
      executor: `@nx/js:${options.compiler}`,
      outputs: ['{options.outputPath}'],
      options: {
        main,
        outputPath: joinPathFragments('dist', options.appProjectRoot),
        tsConfig,
      },
    };
    updateProjectConfiguration(tree, options.projectName, project);
  } else {
    throw new Error('Unsupported bundler type');
  }
}

async function addProject(tree: Tree, options: NormalizedSchema) {
  const targets: Record<string, TargetConfiguration> = {};

  addProjectConfiguration(
    tree,
    options.projectName,
    {
      projectType: 'application',
      root: options.appProjectRoot,
      sourceRoot: joinPathFragments(options.appProjectRoot, 'src'),
      tags: options.parsedTags,
      targets,
    },
    options.standaloneConfig
  );
}

function setDefaults(tree: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(tree);
  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nx/web:application'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    e2eTestRunner: options.e2eTestRunner,
    ...nxJson.generators['@nx/web:application'],
  };
  updateNxJson(tree, nxJson);
}

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

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    callingGenerator: '@nx/web:application',
  });
  options.projectNameAndRootFormat = projectNameAndRootFormat;
  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  let e2eWebServerTarget = 'serve';
  if (options.addPlugin) {
    if (nxJson.plugins) {
      for (const plugin of nxJson.plugins) {
        if (
          options.bundler === 'vite' &&
          typeof plugin === 'object' &&
          plugin.plugin === '@nx/vite/plugin' &&
          (plugin.options as VitePluginOptions).serveTargetName
        ) {
          e2eWebServerTarget = (plugin.options as VitePluginOptions)
            .serveTargetName;
        } else if (
          options.bundler === 'webpack' &&
          typeof plugin === 'object' &&
          plugin.plugin === '@nx/webpack/plugin' &&
          (plugin.options as WebpackPluginOptions).serveTargetName
        ) {
          e2eWebServerTarget = (plugin.options as WebpackPluginOptions)
            .serveTargetName;
        }
      }
    }
  }

  let e2ePort = 4200;
  if (
    nxJson.targetDefaults?.[e2eWebServerTarget] &&
    nxJson.targetDefaults?.[e2eWebServerTarget].options?.port
  ) {
    e2ePort = nxJson.targetDefaults?.[e2eWebServerTarget].options?.port;
  }

  const e2eProjectName = `${appProjectName}-e2e`;
  const e2eProjectRoot = `${appProjectRoot}-e2e`;
  const e2eWebServerAddress = `http://localhost:${e2ePort}`;

  const npmScope = getNpmScope(host);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  options.style = options.style || 'css';
  options.linter = options.linter || ('eslint' as Linter.EsLint);
  options.unitTestRunner = options.unitTestRunner || 'jest';
  options.e2eTestRunner = options.e2eTestRunner || 'playwright';

  return {
    ...options,
    prefix: options.prefix ?? npmScope ?? 'app',
    name: names(options.name).fileName,
    compiler: options.compiler ?? 'babel',
    bundler: options.bundler ?? 'webpack',
    projectName: appProjectName,
    strict: options.strict ?? true,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    e2eWebServerAddress,
    e2eWebServerTarget,
    e2ePort,
    parsedTags,
  };
}

export default applicationGenerator;
