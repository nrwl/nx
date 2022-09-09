import { join } from 'path';
import { webpackProjectGenerator } from '@nrwl/webpack';
import { cypressProjectGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { swcCoreVersion } from '@nrwl/js/src/utils/versions';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';

import { swcLoaderVersion } from '../../utils/versions';
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
  generateFiles(tree, join(__dirname, './files/app'), options.appProjectRoot, {
    ...options,
    ...names(options.name),
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
    rootTsConfigPath: getRelativePathToRootTsConfig(
      tree,
      options.appProjectRoot
    ),
  });
  if (options.unitTestRunner === 'none') {
    tree.delete(join(options.appProjectRoot, './src/app/app.element.spec.ts'));
  }
}

async function addBuildTarget(tree: Tree, options: NormalizedSchema) {
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
    await webpackProjectGenerator(tree, {
      project: options.projectName,
      main,
      tsConfig,
      compiler: options.compiler ?? 'babel',
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
    buildOptions.polyfills = joinPathFragments(
      options.appProjectRoot,
      'src/polyfills.ts'
    );
    buildOptions.styles = [
      joinPathFragments(options.appProjectRoot, `src/styles.${options.style}`),
    ];
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
      executor: `@nrwl/js:${options.compiler}`,
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

async function addServeTarget(tree: Tree, options: NormalizedSchema) {
  const project = readProjectConfiguration(tree, options.projectName);
  project.targets.serve = {
    executor: '@nrwl/webpack:dev-server',
    options: {
      buildTarget: `${options.projectName}:build`,
    },
    configurations: {
      production: {
        buildTarget: `${options.projectName}:build:production`,
      },
    },
  };
  updateProjectConfiguration(tree, options.projectName, project);
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

  await addBuildTarget(tree, options);
  await addServeTarget(tree, options);

  const workspace = readWorkspaceConfiguration(tree);

  if (!workspace.defaultProject) {
    workspace.defaultProject = options.projectName;

    updateWorkspaceConfiguration(tree, workspace);
  }
}

function setDefaults(tree: Tree, options: NormalizedSchema) {
  const workspace = readWorkspaceConfiguration(tree);
  workspace.generators = workspace.generators || {};
  workspace.generators['@nrwl/web:application'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    e2eTestRunner: options.e2eTestRunner,
    ...workspace.generators['@nrwl/web:application'],
  };
  workspace.generators['@nrwl/web:library'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    ...workspace.generators['@nrwl/web:library'],
  };
  updateWorkspaceConfiguration(tree, workspace);
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

  if (options.e2eTestRunner === 'cypress') {
    const cypressTask = await cypressProjectGenerator(host, {
      ...options,
      name: `${options.name}-e2e`,
      directory: options.directory,
      project: options.projectName,
    });
    tasks.push(cypressTask);
  }
  if (options.unitTestRunner === 'jest') {
    const jestTask = await jestProjectGenerator(host, {
      project: options.projectName,
      skipSerializers: true,
      setupFile: 'web-components',
      compiler: options.compiler,
    });
    tasks.push(jestTask);
  }

  if (options.compiler === 'swc') {
    const installTask = await addDependenciesToPackageJson(
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
  const appDirectory = options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const { appsDir, npmScope } = getWorkspaceLayout(host);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = `${appProjectName}-e2e`;

  const appProjectRoot = joinPathFragments(appsDir, appDirectory);
  const e2eProjectRoot = joinPathFragments(appsDir, `${appDirectory}-e2e`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  options.style = options.style || 'css';
  options.linter = options.linter || Linter.EsLint;
  options.unitTestRunner = options.unitTestRunner || 'jest';
  options.e2eTestRunner = options.e2eTestRunner || 'cypress';

  return {
    ...options,
    prefix: options.prefix ?? npmScope,
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
