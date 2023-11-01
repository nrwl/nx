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
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { swcCoreVersion } from '@nx/js/src/utils/versions';
import type { Linter } from '@nx/eslint';
import { join } from 'path';
import { nxVersion, swcLoaderVersion } from '../../utils/versions';
import { webInitGenerator } from '../init/init';
import { Schema } from './schema';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';

interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}

function createApplicationFiles(tree: Tree, options: NormalizedSchema) {
  generateFiles(
    tree,
    join(
      __dirname,
      options.bundler === 'vite' ? './files/app-vite' : './files/app-webpack'
    ),
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
  if (options.unitTestRunner === 'none') {
    tree.delete(join(options.appProjectRoot, './src/app/app.element.spec.ts'));
  }
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
    });
    const project = readProjectConfiguration(tree, options.projectName);
    const prodConfig = project.targets.build.configurations.production;
    const buildOptions = project.targets.build.options;
    buildOptions.assets = assets;
    buildOptions.index = joinPathFragments(
      options.appProjectRoot,
      'src/index.html'
    );
    buildOptions.baseHref = '/';
    buildOptions.styles = [
      joinPathFragments(options.appProjectRoot, `src/styles.${options.style}`),
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
  } else if (options.bundler === 'none') {
    // TODO(jack): Flush this out... no bundler should be possible for web but the experience isn't holistic due to missing features (e.g. writing index.html).
    const project = readProjectConfiguration(tree, options.projectName);
    project.targets.build = {
      executor: `@nx/js:${options.compiler}`,
      outputs: ['{options.outputPath}'],
      options: {
        main,
        outputPath: joinPathFragments('dist', options.appProjectRoot),
        tsConfig,
        assets,
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

  if (options.bundler !== 'vite') {
    await setupBundler(tree, options);
  }
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
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function applicationGeneratorInternal(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);

  const tasks: GeneratorCallback[] = [];

  const webTask = await webInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  tasks.push(webTask);

  createApplicationFiles(host, options);
  await addProject(host, options);

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
      coverageProvider: 'c8',
      inSourceTests: options.inSourceTests,
      skipFormat: true,
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
    const { lintProjectGenerator } = ensurePackage('@nx/eslint', nxVersion);
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      eslintFilePatterns: [`${options.appProjectRoot}/**/*.ts`],
      skipFormat: true,
      setParserOptionsProject: options.setParserOptionsProject,
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
      devServerTarget: `${options.projectName}:serve`,
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
      webServerCommand: `${getPackageManagerCommand().exec} nx serve ${
        options.name
      }`,
      webServerAddress: 'http://localhost:4200',
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

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
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
  const e2eProjectName = `${appProjectName}-e2e`;
  const e2eProjectRoot = `${appProjectRoot}-e2e`;

  const npmScope = getNpmScope(host);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  if (options.bundler === 'vite' && options.unitTestRunner !== 'none') {
    options.unitTestRunner = 'vitest';
  }

  options.style = options.style || 'css';
  options.linter = options.linter || ('eslint' as Linter.EsLint);
  options.unitTestRunner = options.unitTestRunner || 'jest';
  options.e2eTestRunner = options.e2eTestRunner || 'cypress';

  return {
    ...options,
    prefix: options.prefix ?? npmScope ?? 'app',
    name: names(options.name).fileName,
    compiler: options.compiler ?? 'babel',
    bundler: options.bundler ?? 'webpack',
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
  };
}

export default applicationGenerator;
