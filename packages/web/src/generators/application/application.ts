import {
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readWorkspaceConfiguration,
  TargetConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { join } from 'path';

import { webInitGenerator } from '../init/init';
import { cypressProjectGenerator } from '@nrwl/cypress';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { jestProjectGenerator } from '@nrwl/jest';

import { WebBuildExecutorOptions } from '../../executors/build/build.impl';
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
  });
  if (options.unitTestRunner === 'none') {
    tree.delete(join(options.appProjectRoot, './src/app/app.element.spec.ts'));
  }
}

function addBuildTarget(
  project: ProjectConfiguration,
  options: NormalizedSchema
): ProjectConfiguration {
  const buildOptions: WebBuildExecutorOptions = {
    outputPath: joinPathFragments('dist', options.appProjectRoot),
    index: joinPathFragments(options.appProjectRoot, 'src/index.html'),
    baseHref: '/',
    main: joinPathFragments(options.appProjectRoot, 'src/main.ts'),
    polyfills: joinPathFragments(options.appProjectRoot, 'src/polyfills.ts'),
    tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    assets: [
      joinPathFragments(options.appProjectRoot, 'src/favicon.ico'),
      joinPathFragments(options.appProjectRoot, 'src/assets'),
    ],
    styles: [
      joinPathFragments(options.appProjectRoot, `src/styles.${options.style}`),
    ],
    scripts: [],
  };
  const productionBuildOptions: Partial<WebBuildExecutorOptions> = {
    fileReplacements: [
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
    ],
    optimization: true,
    outputHashing: 'all',
    sourceMap: false,
    namedChunks: false,
    extractLicenses: true,
    vendorChunk: false,
  };

  return {
    ...project,
    targets: {
      ...project.targets,
      build: {
        executor: '@nrwl/web:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          production: productionBuildOptions,
        },
      },
    },
  };
}

function addServeTarget(
  project: ProjectConfiguration,
  options: NormalizedSchema
) {
  const serveTarget: TargetConfiguration = {
    executor: '@nrwl/web:dev-server',
    options: {
      buildTarget: `${options.projectName}:build`,
    },
    configurations: {
      production: {
        buildTarget: `${options.projectName}:build:production`,
      },
    },
  };

  return {
    ...project,
    targets: {
      ...project.targets,
      serve: serveTarget,
    },
  };
}

function addProject(tree: Tree, options: NormalizedSchema) {
  const targets: Record<string, TargetConfiguration> = {};
  let project: ProjectConfiguration = {
    projectType: 'application',
    root: options.appProjectRoot,
    sourceRoot: joinPathFragments(options.appProjectRoot, 'src'),
    tags: options.parsedTags,
    targets,
  };

  project = addBuildTarget(project, options);
  project = addServeTarget(project, options);

  addProjectConfiguration(
    tree,
    options.projectName,
    project,
    options.standaloneConfig
  );

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
  addProject(host, options);

  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
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
      babelJest: options.babelJest,
    });
    tasks.push(jestTask);
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

  const { appsDir, npmScope: defaultPrefix } = getWorkspaceLayout(host);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = `${appProjectName}-e2e`;

  const appProjectRoot = `${appsDir}/${appDirectory}`;
  const e2eProjectRoot = `${appsDir}/${appDirectory}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  options.style = options.style || 'css';
  options.linter = options.linter || Linter.EsLint;
  options.unitTestRunner = options.unitTestRunner || 'jest';
  options.e2eTestRunner = options.e2eTestRunner || 'cypress';

  return {
    ...options,
    prefix: options.prefix ?? defaultPrefix,
    name: names(options.name).fileName,
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
  };
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);
