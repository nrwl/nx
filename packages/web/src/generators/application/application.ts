import { join } from 'path';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  ensurePackage,
  extractLayoutDirectory,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
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
} from '@nx/devkit';
import { swcCoreVersion } from '@nx/js/src/utils/versions';
import type { Linter } from '@nx/linter';

import { getRelativePathToRootTsConfig } from '@nx/js';

import { nxVersion, swcLoaderVersion } from '../../utils/versions';
import { webInitGenerator } from '../init/init';
import { Schema } from './schema';

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
    const { webpackProjectGenerator } = ensurePackage('@nx/webpack', nxVersion);
    await webpackProjectGenerator(tree, {
      project: options.projectName,
      main,
      tsConfig,
      compiler: options.compiler ?? 'babel',
      devServer: true,
      isolatedConfig: true,
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
  const options = normalizeOptions(host, schema);

  const tasks: GeneratorCallback[] = [];

  const webTask = await webInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  tasks.push(webTask);

  createApplicationFiles(host, options);
  await addProject(host, options);

  if (options.bundler === 'vite') {
    const { viteConfigurationGenerator } = ensurePackage<
      typeof import('@nx/vite')
    >('@nx/vite', nxVersion);
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
  }

  if (options.bundler !== 'vite' && options.unitTestRunner === 'vitest') {
    const { vitestGenerator } = ensurePackage<typeof import('@nx/vite')>(
      '@nx/vite',
      nxVersion
    );
    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'none',
      project: options.projectName,
      coverageProvider: 'c8',
      inSourceTests: options.inSourceTests,
      skipFormat: true,
    });
    tasks.push(vitestTask);
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
    const { lintProjectGenerator } = await ensurePackage(
      '@nx/linter',
      nxVersion
    );
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
    const { cypressProjectGenerator } = await ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);
    const cypressTask = await cypressProjectGenerator(host, {
      ...options,
      name: `${options.name}-e2e`,
      directory: options.directory,
      project: options.projectName,
      skipFormat: true,
    });
    tasks.push(cypressTask);
  }
  if (options.unitTestRunner === 'jest') {
    const { jestProjectGenerator } = await ensurePackage<
      typeof import('@nx/jest')
    >('@nx/jest', nxVersion);
    const jestTask = await jestProjectGenerator(host, {
      project: options.projectName,
      skipSerializers: true,
      setupFile: 'web-components',
      compiler: options.compiler,
      skipFormat: true,
    });
    tasks.push(jestTask);
  }

  if (options.compiler === 'swc') {
    const installTask = addDependenciesToPackageJson(
      host,
      {},
      { '@swc/core': swcCoreVersion, 'swc-loader': swcLoaderVersion }
    );
    tasks.push(installTask);
  }

  setDefaults(host, options);

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
  return runTasksInSerial(...tasks);
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );

  const appDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const { appsDir: defaultAppsDir, npmScope } = getWorkspaceLayout(host);
  const appsDir = layoutDirectory ?? defaultAppsDir;

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = `${appProjectName}-e2e`;

  const appProjectRoot = joinPathFragments(appsDir, appDirectory);
  const e2eProjectRoot = joinPathFragments(appsDir, `${appDirectory}-e2e`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  if (options.bundler === 'vite' && !options.unitTestRunner) {
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
export const applicationSchematic = convertNxGenerator(applicationGenerator);
