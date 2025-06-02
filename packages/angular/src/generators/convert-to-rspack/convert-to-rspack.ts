import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  joinPathFragments,
  normalizePath,
  readJson,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
  workspaceRoot,
  writeJson,
  type ExpandedPluginConfiguration,
  type GeneratorCallback,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import type { RspackPluginOptions } from '@nx/rspack/plugins/plugin';
import { prompt } from 'enquirer';
import { relative, resolve } from 'path';
import { join } from 'path/posix';
import {
  angularRspackVersion,
  nxVersion,
  tsNodeVersion,
} from '../../utils/versions';
import { createConfig } from './lib/create-config';
import { getCustomWebpackConfig } from './lib/get-custom-webpack-config';
import { updateTsconfig } from './lib/update-tsconfig';
import { validateSupportedBuildExecutor } from './lib/validate-supported-executor';
import type { ConvertToRspackSchema } from './schema';

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
  let buildTarget: { name: string; config: TargetConfiguration } | undefined;
  let serveTarget: { name: string; config: TargetConfiguration } | undefined;
  const targetsToRemove: string[] = [];
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
      buildTarget = { name: targetName, config: target };
      targetsToRemove.push(targetName);
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
      targetsToRemove.push(targetName);
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

        if (target.options.port && target.options.port !== DEFAULT_PORT) {
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
      serveTarget = { name: targetName, config: target };
      targetsToRemove.push(targetName);
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
      targetsToRemove.push(targetName);
    } else if (target.executor === '@angular-devkit/build-angular:app-shell') {
      createConfigOptions.appShell = true;
      targetsToRemove.push(targetName);
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

  for (const targetName of targetsToRemove) {
    delete project.targets[targetName];
  }

  updateProjectConfiguration(tree, projectName, project);

  // ensure plugin is registered
  const { rspackInitGenerator } = ensurePackage<typeof import('@nx/rspack')>(
    '@nx/rspack',
    nxVersion
  );
  await rspackInitGenerator(tree, {
    addPlugin: true,
    framework: 'angular',
  });

  // find the inferred target names
  const nxJson = readNxJson(tree);
  let inferredBuildTargetName = 'build';
  let inferredServeTargetName = 'serve';
  const pluginRegistration = nxJson.plugins.find(
    (p): p is ExpandedPluginConfiguration<RspackPluginOptions> =>
      typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
  );
  if (pluginRegistration) {
    inferredBuildTargetName =
      pluginRegistration.options.buildTargetName ?? inferredBuildTargetName;
    inferredServeTargetName =
      pluginRegistration.options.serveTargetName ?? inferredServeTargetName;
  }

  if (buildTarget) {
    // these are all replaced by the inferred task
    delete buildTarget.config.options;
    delete buildTarget.config.configurations;
    delete buildTarget.config.defaultConfiguration;
    delete buildTarget.config.executor;

    const shouldOverrideInputs = (inputs: TargetConfiguration['inputs']) => {
      if (!inputs?.length) {
        return false;
      }

      if (inputs.length === 2) {
        // check whether the existing inputs would match the inferred task
        // inputs with the exception of the @rspack/cli external dependency
        // which webpack tasks wouldn't have
        const namedInputs = getNamedInputs(project.root, {
          nxJsonConfiguration: nxJson,
          configFiles: [],
          workspaceRoot,
        });

        if ('production' in namedInputs) {
          return !['production', '^production'].every((input) =>
            inputs.includes(input)
          );
        }

        return !['default', '^default'].every((input) =>
          inputs.includes(input)
        );
      }

      return true;
    };

    if (shouldOverrideInputs(buildTarget.config.inputs)) {
      // keep existing inputs and add the @rspack/cli external dependency
      buildTarget.config.inputs = [
        ...buildTarget.config.inputs,
        { externalDependencies: ['@rspack/cli'] },
      ];
    } else {
      delete buildTarget.config.inputs;
    }

    if (buildTarget.config.cache) {
      delete buildTarget.config.cache;
    }

    if (
      buildTarget.config.dependsOn?.length === 1 &&
      buildTarget.config.dependsOn[0] === `^${buildTarget.name}`
    ) {
      delete buildTarget.config.dependsOn;
    } else if (buildTarget.config.dependsOn) {
      buildTarget.config.dependsOn = buildTarget.config.dependsOn.map((dep) =>
        dep === `^${buildTarget.name}` ? `^${inferredBuildTargetName}` : dep
      );
    }

    const newOutputPath = joinPathFragments(
      project.root,
      createConfigOptions.outputPath.base
    );
    const shouldOverrideOutputs = (outputs: TargetConfiguration['outputs']) => {
      if (!outputs?.length) {
        // this means the target was wrongly configured, so, we don't override
        // anything and let the inferred outputs be used
        return false;
      }

      if (outputs.length === 1) {
        if (outputs[0] === '{options.outputPath}') {
          // the inferred task output is created after the createConfig
          // outputPath option, so we don't need to keep this
          return false;
        }

        const normalizedOutputPath = outputs[0]
          .replace('{workspaceRoot}/', '')
          .replace('{projectRoot}', project.root)
          .replace('{projectName}', '');
        if (
          normalizedOutputPath === newOutputPath ||
          normalizedOutputPath.replace(/\/browser\/?$/, '') === newOutputPath
        ) {
          return false;
        }
      }

      return true;
    };
    const normalizeOutput = (
      path: string,
      workspaceRoot: string,
      projectRoot: string
    ) => {
      const fullProjectRoot = resolve(workspaceRoot, projectRoot);
      const fullPath = resolve(workspaceRoot, path);
      const pathRelativeToProjectRoot = normalizePath(
        relative(fullProjectRoot, fullPath)
      );
      if (pathRelativeToProjectRoot.startsWith('..')) {
        return joinPathFragments(
          '{workspaceRoot}',
          relative(workspaceRoot, fullPath)
        );
      }

      return joinPathFragments('{projectRoot}', pathRelativeToProjectRoot);
    };

    if (shouldOverrideOutputs(buildTarget.config.outputs)) {
      buildTarget.config.outputs = buildTarget.config.outputs.map((output) => {
        if (output === '{options.outputPath}') {
          // the target won't have an outputPath option, so we replace it with the new output path
          return normalizeOutput(newOutputPath, workspaceRoot, project.root);
        }

        const normalizedOutputPath = output
          .replace('{workspaceRoot}/', '')
          .replace('{projectRoot}', project.root)
          .replace('{projectName}', '');
        if (
          /\/browser\/?$/.test(normalizedOutputPath) &&
          normalizedOutputPath.replace(/\/browser\/?$/, '') === newOutputPath
        ) {
          return normalizeOutput(newOutputPath, workspaceRoot, project.root);
        }

        return output;
      });
    } else {
      delete buildTarget.config.outputs;
    }

    if (
      buildTarget.config.syncGenerators?.length === 1 &&
      buildTarget.config.syncGenerators[0] === '@nx/js:typescript-sync'
    ) {
      delete buildTarget.config.syncGenerators;
    } else if (buildTarget.config.syncGenerators?.length) {
      buildTarget.config.syncGenerators = Array.from(
        new Set([
          ...buildTarget.config.syncGenerators,
          '@nx/js:typescript-sync',
        ])
      );
    }

    if (Object.keys(buildTarget.config).length) {
      // there's extra target metadata left that wouldn't be inferred, we keep it
      project.targets[inferredBuildTargetName] = buildTarget.config;
    }
  }
  if (serveTarget) {
    delete serveTarget.config.options;
    delete serveTarget.config.configurations;
    delete serveTarget.config.defaultConfiguration;
    delete serveTarget.config.executor;

    if (serveTarget.config.continuous) {
      delete serveTarget.config.continuous;
    }
    if (
      serveTarget.config.syncGenerators?.length === 1 &&
      serveTarget.config.syncGenerators[0] === '@nx/js:typescript-sync'
    ) {
      delete serveTarget.config.syncGenerators;
    } else if (serveTarget.config.syncGenerators?.length) {
      serveTarget.config.syncGenerators = Array.from(
        new Set([
          ...serveTarget.config.syncGenerators,
          '@nx/js:typescript-sync',
        ])
      );
    }

    if (projectServePort !== DEFAULT_PORT) {
      serveTarget.config.options = {};
      serveTarget.config.options.port = projectServePort;
    }

    if (Object.keys(serveTarget.config).length) {
      // there's extra target metadata left that wouldn't be inferred, we keep it
      project.targets[inferredServeTargetName] = serveTarget.config;
    }
  }

  updateProjectConfiguration(tree, projectName, project);

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
