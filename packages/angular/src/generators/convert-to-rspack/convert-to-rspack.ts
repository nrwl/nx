import {
  type Tree,
  readProjectConfiguration,
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  runTasksInSerial,
  ensurePackage,
  updateProjectConfiguration,
  workspaceRoot,
  joinPathFragments,
  readJson,
  writeJson,
} from '@nx/devkit';
import type { ConvertToRspackSchema } from './schema';
import {
  angularRspackVersion,
  nxVersion,
  tsNodeVersion,
  webpackMergeVersion,
} from '../../utils/versions';
import { createConfig } from './lib/create-config';
import { getCustomWebpackConfig } from './lib/get-custom-webpack-config';
import { updateTsconfig } from './lib/update-tsconfig';
import { validateSupportedBuildExecutor } from './lib/validate-supported-executor';
import { join } from 'path/posix';
import { relative } from 'path';
import { existsSync } from 'fs';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { prompt } from 'enquirer';

const SUPPORTED_EXECUTORS = [
  '@angular-devkit/build-angular:browser',
  '@angular-devkit/build-angular:dev-server',
  '@angular-devkit/build-angular:server',
  '@angular-devkit/build-angular:prerender',
  '@angular-devkit/build-angular:app-shell',
  '@nx/angular:webpack-browser',
  '@nx/angular:webpack-server',
  '@nx/angular:dev-server',
  '@nx/angular:module-federation-dev-server',
];

const RENAMED_OPTIONS = {
  main: 'browser',
  ngswConfigPath: 'serviceWorker',
};

const DEFAULT_PORT = 4200;

const REMOVED_OPTIONS = [
  'buildOptimizer',
  'buildTarget',
  'browserTarget',
  'publicHost',
];

function normalizeFromProjectRoot(
  tree: Tree,
  path: string,
  projectRoot: string
) {
  if (projectRoot === '.') {
    if (!path.startsWith('./')) {
      return `./${path}`;
    } else {
      return path;
    }
  } else if (path.startsWith(projectRoot)) {
    return path.replace(projectRoot, '.');
  } else if (!path.startsWith('./')) {
    if (tree.exists(path)) {
      const pathWithWorkspaceRoot = joinPathFragments(workspaceRoot, path);
      const projectRootWithWorkspaceRoot = joinPathFragments(
        workspaceRoot,
        projectRoot
      );
      return relative(projectRootWithWorkspaceRoot, pathWithWorkspaceRoot);
    }
    return `./${path}`;
  }
  return path;
}

const defaultNormalizer = (tree: Tree, path: string, root: string) =>
  normalizeFromProjectRoot(tree, path, root);

const PATH_NORMALIZER = {
  index: (
    tree: Tree,
    path: string | { input: string; output: string },
    root: string
  ) => {
    if (typeof path === 'string') {
      return normalizeFromProjectRoot(tree, path, root);
    }
    return {
      input: normalizeFromProjectRoot(tree, path.input, root),
      output: path.output ?? 'index.html',
    };
  },
  indexHtmlTransformer: defaultNormalizer,
  main: defaultNormalizer,
  server: defaultNormalizer,
  tsConfig: defaultNormalizer,
  outputPath: (tree: Tree, path: string, root: string) => {
    const relativePathFromWorkspaceRoot = relative(
      joinPathFragments(workspaceRoot, root),
      workspaceRoot
    );
    return joinPathFragments(relativePathFromWorkspaceRoot, path);
  },
  proxyConfig: defaultNormalizer,
  polyfills: (tree: Tree, paths: string | string[], root: string) => {
    const normalizedPaths: string[] = [];
    const normalizeFn = (path: string) => {
      if (path.startsWith('zone.js')) {
        normalizedPaths.push(path);
        return;
      }
      try {
        const resolvedPath = require.resolve(path, {
          paths: [join(workspaceRoot, 'node_modules')],
        });
        normalizedPaths.push(path);
      } catch {
        normalizedPaths.push(normalizeFromProjectRoot(tree, path, root));
      }
    };

    if (typeof paths === 'string') {
      normalizeFn(paths);
    } else {
      for (const path of paths) {
        normalizeFn(path);
      }
    }
    return normalizedPaths;
  },
  styles: (
    tree: Tree,
    paths: Array<
      string | { input: string; bundleName: string; inject: boolean }
    >,
    root: string
  ) => {
    const normalizedPaths: Array<
      string | { input: string; bundleName: string; inject: boolean }
    > = [];
    for (const path of paths) {
      if (typeof path === 'string') {
        normalizedPaths.push(normalizeFromProjectRoot(tree, path, root));
      } else {
        normalizedPaths.push({
          input: normalizeFromProjectRoot(tree, path.input, root),
          bundleName: path.bundleName,
          inject: path.inject ?? true,
        });
      }
    }
    return normalizedPaths;
  },
  scripts: (
    tree: Tree,
    paths: Array<
      string | { input: string; bundleName: string; inject: boolean }
    >,
    root: string
  ) => {
    const normalizedPaths: Array<
      string | { input: string; bundleName: string; inject: boolean }
    > = [];
    for (const path of paths) {
      if (typeof path === 'string') {
        normalizedPaths.push(normalizeFromProjectRoot(tree, path, root));
      } else {
        normalizedPaths.push({
          input: normalizeFromProjectRoot(tree, path.input, root),
          bundleName: path.bundleName,
          inject: path.inject ?? true,
        });
      }
    }
    return normalizedPaths;
  },
  assets: (
    tree: Tree,
    paths: Array<string | { input: string; [key: string]: any }>,
    root: string
  ) => {
    const normalizedPaths: Array<
      string | { input: string; [key: string]: any }
    > = [];
    for (const path of paths) {
      if (typeof path === 'string') {
        normalizedPaths.push(normalizeFromProjectRoot(tree, path, root));
      } else {
        normalizedPaths.push({
          ...path,
          input: normalizeFromProjectRoot(tree, path.input, root),
        });
      }
    }
    return normalizedPaths;
  },
  fileReplacements: (
    tree: Tree,
    paths: Array<
      { replace: string; with: string } | { src: string; replaceWith: string }
    >,
    root: string
  ) => {
    const normalizedPaths: Array<
      { replace: string; with: string } | { src: string; replaceWith: string }
    > = [];
    for (const path of paths) {
      normalizedPaths.push({
        replace: normalizeFromProjectRoot(
          tree,
          'src' in path ? path.src : path.replace,
          root
        ),
        with: normalizeFromProjectRoot(
          tree,
          'replaceWith' in path ? path.replaceWith : path.with,
          root
        ),
      });
    }
    return normalizedPaths;
  },
};

function handleBuildTargetOptions(
  tree: Tree,
  options: Record<string, any>,
  newConfigurationOptions: Record<string, any>,
  root: string
) {
  let customWebpackConfigPath: string | undefined;
  if (!options || Object.keys(options).length === 0) {
    return customWebpackConfigPath;
  }

  if (options.customWebpackConfig) {
    customWebpackConfigPath = options.customWebpackConfig.path;
    delete options.customWebpackConfig;
  }

  if (options.outputs) {
    // handled by the Rspack inference plugin
    delete options.outputs;
  }

  for (const [key, value] of Object.entries(options)) {
    let optionName = key;
    let optionValue =
      key in PATH_NORMALIZER ? PATH_NORMALIZER[key](tree, value, root) : value;
    if (REMOVED_OPTIONS.includes(key)) {
      continue;
    }
    if (key in RENAMED_OPTIONS) {
      optionName = RENAMED_OPTIONS[key];
    }
    newConfigurationOptions[optionName] = optionValue;
  }

  if (typeof newConfigurationOptions.polyfills === 'string') {
    newConfigurationOptions.polyfills = [newConfigurationOptions.polyfills];
  }
  let outputPath = newConfigurationOptions.outputPath;
  if (typeof outputPath === 'string') {
    if (!/\/browser\/?$/.test(outputPath)) {
      console.warn(
        `The output location of the browser build has been updated from "${outputPath}" to ` +
          `"${join(outputPath, 'browser')}". ` +
          'You might need to adjust your deployment pipeline or, as an alternative, ' +
          'set outputPath.browser to "" in order to maintain the previous functionality.'
      );
    } else {
      outputPath = outputPath.replace(/\/browser\/?$/, '');
    }

    newConfigurationOptions['outputPath'] = {
      base: outputPath,
    };

    if (typeof newConfigurationOptions.resourcesOutputPath === 'string') {
      const media = newConfigurationOptions.resourcesOutputPath.replaceAll(
        '/',
        ''
      );
      if (media && media !== 'media') {
        newConfigurationOptions['outputPath'] = {
          base: outputPath,
          media,
        };
      }
    }
  }
  return customWebpackConfigPath;
}

function handleDevServerTargetOptions(
  tree: Tree,
  options: Record<string, any>,
  newConfigurationOptions: Record<string, any>,
  root: string
) {
  for (const [key, value] of Object.entries(options)) {
    let optionName = key;
    let optionValue =
      key in PATH_NORMALIZER ? PATH_NORMALIZER[key](tree, value, root) : value;
    if (REMOVED_OPTIONS.includes(key)) {
      continue;
    }
    if (key in RENAMED_OPTIONS) {
      optionName = RENAMED_OPTIONS[key];
    }
    newConfigurationOptions[optionName] = optionValue;
  }
}

async function getProjectToConvert(tree: Tree) {
  const projects = new Set<string>();
  for (const executor of SUPPORTED_EXECUTORS) {
    forEachExecutorOptions(tree, executor, (_, project) => {
      projects.add(project);
    });
  }
  const { project } = await prompt<{ project: string }>({
    type: 'select',
    name: 'project',
    message: 'Which project would you like to convert to rspack?',
    choices: Array.from(projects),
  });

  return project;
}

export async function convertToRspack(
  tree: Tree,
  schema: ConvertToRspackSchema
) {
  let { project: projectName } = schema;
  if (!projectName) {
    projectName = await getProjectToConvert(tree);
  }
  const project = readProjectConfiguration(tree, projectName);
  const tasks: GeneratorCallback[] = [];

  const createConfigOptions: Record<string, any> = {
    root: project.root,
  };
  const configurationOptions: Record<string, Record<string, any>> = {};
  const buildTargetNames: string[] = [];
  const serveTargetNames: string[] = [];
  let customWebpackConfigPath: string | undefined;

  validateSupportedBuildExecutor(Object.values(project.targets));

  let projectServePort = DEFAULT_PORT;

  for (const [targetName, target] of Object.entries(project.targets)) {
    if (
      target.executor === '@angular-devkit/build-angular:browser' ||
      target.executor === '@nx/angular:webpack-browser'
    ) {
      customWebpackConfigPath = handleBuildTargetOptions(
        tree,
        target.options,
        createConfigOptions,
        project.root
      );
      if (target.configurations) {
        for (const [configurationName, configuration] of Object.entries(
          target.configurations
        )) {
          configurationOptions[configurationName] = {};
          handleBuildTargetOptions(
            tree,
            configuration,
            configurationOptions[configurationName],
            project.root
          );
        }
      }
      buildTargetNames.push(targetName);
    } else if (
      target.executor === '@angular-devkit/build-angular:server' ||
      target.executor === '@nx/angular:webpack-server'
    ) {
      createConfigOptions.ssr ??= {};
      createConfigOptions.ssr.entry ??= normalizeFromProjectRoot(
        tree,
        target.options.main,
        project.root
      );
      createConfigOptions.server = './src/main.server.ts';
      buildTargetNames.push(targetName);
    } else if (
      target.executor === '@angular-devkit/build-angular:dev-server' ||
      target.executor === '@nx/angular:dev-server' ||
      target.executor === '@nx/angular:module-federation-dev-server'
    ) {
      createConfigOptions.devServer = {};
      if (target.options) {
        handleDevServerTargetOptions(
          tree,
          target.options,
          createConfigOptions.devServer,
          project.root
        );

        if (target.options.port !== DEFAULT_PORT) {
          projectServePort = target.options.port;
        }
      }
      if (target.configurations) {
        for (const [configurationName, configuration] of Object.entries(
          target.configurations
        )) {
          configurationOptions[configurationName] ??= {};
          configurationOptions[configurationName].devServer ??= {};
          handleDevServerTargetOptions(
            tree,
            configuration,
            configurationOptions[configurationName].devServer,
            project.root
          );
        }
      }
      serveTargetNames.push(targetName);
    } else if (target.executor === '@angular-devkit/build-angular:prerender') {
      if (target.options) {
        const prerenderOptions = {
          routesFile: target.options.routesFile,
          discoverRoutes: target.options.discoverRoutes ?? true,
          routes: target.options.routes ?? [],
        };
        createConfigOptions.prerender = prerenderOptions;
        if (target.configurations) {
          for (const [configurationName, configuration] of Object.entries(
            target.configurations
          )) {
            configurationOptions[configurationName] ??= {};
            configurationOptions[configurationName].prerender ??= {
              routesFile: configuration.routesFile,
              discoverRoutes: configuration.discoverRoutes ?? true,
              routes: configuration.routes ?? [],
            };
          }
        }
      }
      buildTargetNames.push(targetName);
    } else if (target.executor === '@angular-devkit/build-angular:app-shell') {
      createConfigOptions.appShell = true;
      buildTargetNames.push(targetName);
    }
  }

  const customWebpackConfigInfo = customWebpackConfigPath
    ? await getCustomWebpackConfig(tree, project.root, customWebpackConfigPath)
    : undefined;

  createConfig(
    tree,
    createConfigOptions,
    configurationOptions,
    customWebpackConfigInfo?.normalizedPathToCustomWebpackConfig,
    customWebpackConfigInfo?.isWebpackConfigFunction
  );
  updateTsconfig(tree, project.root);

  for (const targetName of [...buildTargetNames, ...serveTargetNames]) {
    delete project.targets[targetName];
  }

  if (projectServePort !== DEFAULT_PORT) {
    project.targets.serve ??= {};
    project.targets.serve.options ??= {};
    project.targets.serve.options.port = projectServePort;
  }

  updateProjectConfiguration(tree, projectName, project);

  const { rspackInitGenerator } = ensurePackage<typeof import('@nx/rspack')>(
    '@nx/rspack',
    nxVersion
  );

  await rspackInitGenerator(tree, {
    addPlugin: true,
    framework: 'angular',
  });

  // This is needed to prevent a circular execution of the build target
  const rootPkgJson = readJson(tree, 'package.json');
  if (rootPkgJson.scripts?.build === 'nx build') {
    delete rootPkgJson.scripts.build;
    writeJson(tree, 'package.json', rootPkgJson);
  }

  if (!schema.skipInstall) {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/angular-rspack': angularRspackVersion,
        'webpack-merge': webpackMergeVersion,
        'ts-node': tsNodeVersion,
      }
    );
    tasks.push(installTask);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default convertToRspack;
