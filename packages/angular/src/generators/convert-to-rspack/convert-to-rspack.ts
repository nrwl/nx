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
} from '@nx/devkit';
import type { ConvertToRspackSchema } from './schema';
import { angularRspackVersion, nxVersion } from '../../utils/versions';
import { createConfig } from './lib/create-config';
import { getCustomWebpackConfig } from './lib/get-custom-webpack-config';
import { updateTsconfig } from './lib/update-tsconfig';
import { validateSupportedBuildExecutor } from './lib/validate-supported-executor';
import { join } from 'path/posix';
import { relative } from 'path';

const SUPPORTED_EXECUTORS = [
  '@angular-devkit/build-angular:browser',
  '@angular-devkit/build-angular:dev-server',
  '@nx/angular:webpack-browser',
  '@nx/angular:dev-server',
  '@nx/angular:module-federation-dev-server',
];

const RENAMED_OPTIONS = {
  main: 'browser',
  ngswConfigPath: 'serviceWorker',
};

const REMOVED_OPTIONS = [
  'publicHost',
  'disableHostCheck',
  'resourcesOutputPath',
  'routesFile',
  'routes',
  'discoverRoutes',
  'appModuleBundle',
  'inputIndexPath',
  'outputIndexPath',
  'buildOptimizer',
  'deployUrl',
  'buildTarget',
  'browserTarget',
];

function normalizeFromProjectRoot(path: string, projectRoot: string) {
  if (projectRoot === '.') {
    if (!path.startsWith('./')) {
      return `./${path}`;
    } else {
      return path;
    }
  } else if (path.startsWith(projectRoot)) {
    return path.replace(projectRoot, '.');
  } else if (!path.startsWith('./')) {
    return `./${path}`;
  }
  return path;
}

const defaultNormalizer = (path: string, root: string) =>
  normalizeFromProjectRoot(path, root);

const PATH_NORMALIZER = {
  index: (path: string | { input: string; output: string }, root: string) => {
    if (typeof path === 'string') {
      return normalizeFromProjectRoot(path, root);
    }
    return {
      input: normalizeFromProjectRoot(path.input, root),
      output: path.output ?? 'index.html',
    };
  },
  indexHtmlTransformer: defaultNormalizer,
  main: defaultNormalizer,
  server: defaultNormalizer,
  tsConfig: defaultNormalizer,
  outputPath: (path: string, root: string) => {
    const relativePathFromWorkspaceRoot = relative(
      joinPathFragments(workspaceRoot, root),
      workspaceRoot
    );
    return joinPathFragments(
      relativePathFromWorkspaceRoot,
      normalizeFromProjectRoot(path, root)
    );
  },
  proxyConfig: defaultNormalizer,
  styles: (
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
        normalizedPaths.push(normalizeFromProjectRoot(path, root));
      } else {
        normalizedPaths.push({
          input: normalizeFromProjectRoot(path.input, root),
          bundleName: path.bundleName,
          inject: path.inject ?? true,
        });
      }
    }
    return normalizedPaths;
  },
  scripts: (
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
        normalizedPaths.push(normalizeFromProjectRoot(path, root));
      } else {
        normalizedPaths.push({
          input: normalizeFromProjectRoot(path.input, root),
          bundleName: path.bundleName,
          inject: path.inject ?? true,
        });
      }
    }
    return normalizedPaths;
  },
  assets: (
    paths: Array<string | { input: string; [key: string]: any }>,
    root: string
  ) => {
    const normalizedPaths: Array<
      string | { input: string; [key: string]: any }
    > = [];
    for (const path of paths) {
      if (typeof path === 'string') {
        normalizedPaths.push(normalizeFromProjectRoot(path, root));
      } else {
        normalizedPaths.push({
          ...path,
          input: normalizeFromProjectRoot(path.input, root),
        });
      }
    }
    return normalizedPaths;
  },
  fileReplacements: (
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
          'src' in path ? path.src : path.replace,
          root
        ),
        with: normalizeFromProjectRoot(
          'replaceWith' in path ? path.replaceWith : path.with,
          root
        ),
      });
    }
    return normalizedPaths;
  },
};

function handleBuildTargetOptions(
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
      key in PATH_NORMALIZER ? PATH_NORMALIZER[key](value, root) : value;
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
  options: Record<string, any>,
  newConfigurationOptions: Record<string, any>,
  root: string
) {
  for (const [key, value] of Object.entries(options)) {
    let optionName = key;
    let optionValue =
      key in PATH_NORMALIZER ? PATH_NORMALIZER[key](value, root) : value;
    if (REMOVED_OPTIONS.includes(key)) {
      continue;
    }
    if (key in RENAMED_OPTIONS) {
      optionName = RENAMED_OPTIONS[key];
    }
    newConfigurationOptions[optionName] = optionValue;
  }
}

export async function convertToRspack(
  tree: Tree,
  schema: ConvertToRspackSchema
) {
  const { project: projectName } = schema;
  const project = readProjectConfiguration(tree, projectName);
  const tasks: GeneratorCallback[] = [];

  const createConfigOptions: Record<string, any> = {
    root: project.root,
  };
  const configurationOptions: Record<string, Record<string, any>> = {};
  const buildTargetNames: string[] = [];
  let customWebpackConfigPath: string | undefined;

  validateSupportedBuildExecutor(Object.values(project.targets));

  for (const [targetName, target] of Object.entries(project.targets)) {
    if (
      target.executor === '@angular-devkit/build-angular:browser' ||
      target.executor === '@nx/angular:webpack-browser'
    ) {
      customWebpackConfigPath = handleBuildTargetOptions(
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
            configuration,
            configurationOptions[configurationName],
            project.root
          );
        }
      }
      buildTargetNames.push(targetName);
    } else if (
      target.executor === '@angular-devkit/build-angular:dev-server' ||
      target.executor === '@nx/angular:dev-server' ||
      target.executor === '@nx/angular:module-federation-dev-server'
    ) {
      createConfigOptions.devServer = {};
      handleDevServerTargetOptions(
        target.options,
        createConfigOptions.devServer,
        project.root
      );
      if (target.configurations) {
        for (const [configurationName, configuration] of Object.entries(
          target.configurations
        )) {
          configurationOptions[configurationName] ??= {};
          configurationOptions[configurationName].devServer ??= {};
          handleDevServerTargetOptions(
            configuration,
            configurationOptions[configurationName].devServer,
            project.root
          );
        }
      }
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

  for (const targetName of buildTargetNames) {
    delete project.targets[targetName];
  }

  updateProjectConfiguration(tree, projectName, project);

  const { rspackInitGenerator } = ensurePackage<typeof import('@nx/rspack')>(
    '@nx/rspack',
    nxVersion
  );

  await rspackInitGenerator(tree, {
    addPlugin: true,
  });

  if (!schema.skipInstall) {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/angular-rspack': angularRspackVersion,
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
