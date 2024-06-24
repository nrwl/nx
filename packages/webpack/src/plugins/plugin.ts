import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  logger,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import { existsSync, readdirSync } from 'fs';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { readWebpackOptions } from '../utils/webpack/read-webpack-options';
import { resolveUserDefinedWebpackConfig } from '../utils/webpack/resolve-user-defined-webpack-config';

export interface WebpackPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  previewTargetName?: string;
}

type WebpackTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(cachePath: string): Record<string, WebpackTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  results?: Record<string, WebpackTargets>
) {
  writeJsonFile(cachePath, results);
}

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const webpackConfigGlob = '**/webpack.config.{js,ts,mjs,cjs}';

export const createNodesV2: CreateNodesV2<WebpackPluginOptions> = [
  webpackConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `webpack-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    const normalizedOptions = normalizeOptions(options);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFilePaths,
        normalizedOptions,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodes: CreateNodes<WebpackPluginOptions> = [
  webpackConfigGlob,
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    const normalizedOptions = normalizeOptions(options);
    return createNodesInternal(configFilePath, normalizedOptions, context, {});
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: Required<WebpackPluginOptions>,
  context: CreateNodesContext,
  targetsCache: Record<string, WebpackTargets>
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFilePath);

  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= await createWebpackTargets(
    configFilePath,
    projectRoot,
    options,
    context
  );

  const { targets, metadata } = targetsCache[hash];

  return {
    projects: {
      [projectRoot]: {
        projectType: 'application',
        targets,
        metadata,
      },
    },
  };
}

async function createWebpackTargets(
  configFilePath: string,
  projectRoot: string,
  options: Required<WebpackPluginOptions>,
  context: CreateNodesContext
): Promise<WebpackTargets> {
  const pmc = getPackageManagerCommand();
  const namedInputs = getNamedInputs(projectRoot, context);

  const webpackConfig = resolveUserDefinedWebpackConfig(
    join(context.workspaceRoot, configFilePath),
    getRootTsConfigPath(),
    true
  );

  const webpackOptions = await readWebpackOptions(webpackConfig);

  const outputPath = normalizeOutputPath(
    webpackOptions.output?.path,
    projectRoot
  );

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = {
    command: `webpack-cli build`,
    options: { cwd: projectRoot, args: ['--node-env=production'] },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs:
      'production' in namedInputs
        ? [
            'production',
            '^production',
            {
              externalDependencies: ['webpack-cli'],
            },
          ]
        : [
            'default',
            '^default',
            {
              externalDependencies: ['webpack-cli'],
            },
          ],
    outputs: [outputPath],
    metadata: {
      technologies: ['webpack'],
      description: 'Runs Webpack build',
      help: {
        command: `${pmc.exec} webpack-cli build --help`,
        example: {
          options: {
            json: 'stats.json',
          },
          args: ['--profile'],
        },
      },
    },
  };

  targets[options.serveTargetName] = {
    command: `webpack-cli serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=development'],
    },
    metadata: {
      technologies: ['webpack'],
      description: 'Starts Webpack dev server',
      help: {
        command: `${pmc.exec} webpack-cli serve --help`,
        example: {
          options: {
            args: ['--client-progress', '--history-api-fallback '],
          },
        },
      },
    },
  };

  targets[options.previewTargetName] = {
    command: `webpack-cli serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=production'],
    },
    metadata: {
      technologies: ['webpack'],
      description: 'Starts Webpack dev server in production mode',
      help: {
        command: `${pmc.exec} webpack-cli serve --help`,
        example: {
          options: {
            args: ['--client-progress', '--history-api-fallback '],
          },
        },
      },
    },
  };

  targets[options.serveStaticTargetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: options.buildTargetName,
      spa: true,
    },
  };

  return { targets, metadata: {} };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string
): string | undefined {
  if (!outputPath) {
    // If outputPath is undefined, use webpack's default `dist` directory.
    if (projectRoot === '.') {
      return `{projectRoot}/dist`;
    } else {
      return `{workspaceRoot}/dist/{projectRoot}`;
    }
  } else {
    if (isAbsolute(outputPath)) {
      /**
       * If outputPath is absolute, we need to resolve it relative to the workspaceRoot first.
       * After that, we can use the relative path to the workspaceRoot token {workspaceRoot} to generate the output path.
       */
      return `{workspaceRoot}/${relative(
        workspaceRoot,
        resolve(workspaceRoot, outputPath)
      )}`;
    } else {
      if (outputPath.startsWith('..')) {
        return join('{workspaceRoot}', join(projectRoot, outputPath));
      } else {
        return join('{projectRoot}', outputPath);
      }
    }
  }
}

function normalizeOptions(
  options: WebpackPluginOptions
): Required<WebpackPluginOptions> {
  return {
    buildTargetName: options?.buildTargetName ?? 'build',
    serveTargetName: options?.serveTargetName ?? 'serve',
    serveStaticTargetName: options?.serveStaticTargetName ?? 'serve-static',
    previewTargetName: options?.previewTargetName ?? 'preview',
  };
}
