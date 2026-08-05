import {
  calculateHashesForCreateNodes,
  getNamedInputs,
  PluginCache,
  hashObject,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  CreateDependencies,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesResultArray,
  CreateNodes,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  ProjectConfiguration,
  TargetConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import {
  isUsingTsSolutionSetup,
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  addBuildAndWatchDepsTargets,
} from '@nx/js/internal';
import { readdirSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { readWebpackOptions } from '../utils/webpack/read-webpack-options';
import { resolveUserDefinedWebpackConfig } from '../utils/webpack/resolve-user-defined-webpack-config';
export interface WebpackPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  previewTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type WebpackTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const webpackConfigGlob = '**/webpack.config.{js,ts,mjs,cjs}';

export const createNodes: CreateNodes<WebpackPluginOptions> = [
  webpackConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `webpack-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<WebpackTargets>(cachePath);
    const normalizedOptions = normalizeOptions(options);
    const isTsSolutionSetup = isUsingTsSolutionSetup();
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);

    try {
      const { entries, preErrors } = await filterWebpackConfigs(
        configFilePaths,
        context
      );

      const projectHashes = await calculateHashesForCreateNodes(
        entries.map((e) => e.projectRoot),
        normalizedOptions,
        context,
        entries.map(() => [lockFileName])
      );

      let results: CreateNodesResultArray = [];
      let nodeErrors: Array<[string | null, Error]> = [];
      try {
        results = await createNodesFromFiles(
          (configFile, opts, ctx, idx) =>
            createNodesInternal(
              configFile,
              opts,
              ctx,
              targetsCache,
              isTsSolutionSetup,
              pmc,
              projectHashes[idx]
            ),
          entries.map((e) => e.configFile),
          normalizedOptions,
          context
        );
      } catch (e) {
        if (e instanceof AggregateCreateNodesError) {
          results = e.partialResults ?? [];
          nodeErrors = e.errors;
        } else {
          throw e;
        }
      }

      const allErrors = [...preErrors, ...nodeErrors];
      if (allErrors.length > 0) {
        throw new AggregateCreateNodesError(allErrors, results);
      }
      return results;
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFilePath: string,
  options: Required<WebpackPluginOptions>,
  context: CreateNodesContext,
  targetsCache: PluginCache<WebpackTargets>,
  isTsSolutionSetup: boolean,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  hash: string
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFilePath);

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      await createWebpackTargets(
        configFilePath,
        projectRoot,
        options,
        context,
        isTsSolutionSetup,
        pmc
      )
    );
  }

  const { targets, metadata } = targetsCache.get(hash);

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
  context: CreateNodesContext,
  isTsSolutionSetup: boolean,
  pmc: ReturnType<typeof getPackageManagerCommand>
): Promise<WebpackTargets> {
  const namedInputs = getNamedInputs(projectRoot, context);

  const webpackConfig = resolveUserDefinedWebpackConfig(
    join(context.workspaceRoot, configFilePath),
    getRootTsConfigPath(),
    true
  );

  const webpackOptions = await readWebpackOptions(webpackConfig);

  const outputs = [];
  for (const config of webpackOptions) {
    if (config.output?.path) {
      outputs.push(normalizeOutputPath(config.output.path, projectRoot));
    }
  }

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = {
    command: `webpack-cli build`,
    options: { cwd: projectRoot, env: { NODE_ENV: 'production' } },
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
            TS_SOLUTION_SETUP_TSCONFIG_INPUT,
          ]
        : [
            'default',
            '^default',
            {
              externalDependencies: ['webpack-cli'],
            },
            TS_SOLUTION_SETUP_TSCONFIG_INPUT,
          ],
    outputs,
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
    continuous: true,
    command: `webpack-cli serve`,
    options: {
      cwd: projectRoot,
      env: { NODE_ENV: 'development' },
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
    continuous: true,
    command: `webpack-cli serve`,
    options: {
      cwd: projectRoot,
      env: { NODE_ENV: 'production' },
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
    continuous: true,
    dependsOn: [options.buildTargetName],
    executor: '@nx/web:file-server',
    options: {
      buildTarget: options.buildTargetName,
      spa: true,
    },
  };

  // for `convert-to-inferred` we need to leave the port undefined or the options will not match
  if (webpackConfig.devServer?.port && webpackConfig.devServer?.port !== 4200) {
    targets[options.serveStaticTargetName].options.port =
      webpackConfig.devServer.port;
  }

  if (isTsSolutionSetup) {
    targets[options.buildTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
    targets[options.serveTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
    targets[options.previewTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
    targets[options.serveStaticTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
  }

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

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
        return joinPathFragments('{workspaceRoot}', projectRoot, outputPath);
      } else {
        return joinPathFragments('{projectRoot}', outputPath);
      }
    }
  }
}

interface WebpackEntry {
  configFile: string;
  projectRoot: string;
}

async function filterWebpackConfigs(
  configFiles: readonly string[],
  context: CreateNodesContext
): Promise<{
  entries: WebpackEntry[];
  preErrors: Array<[string, Error]>;
}> {
  const preErrors: Array<[string, Error]> = [];
  const candidates = await Promise.all(
    configFiles.map(async (configFile): Promise<WebpackEntry | null> => {
      try {
        const projectRoot = dirname(configFile);
        const siblingFiles = readdirSync(
          join(context.workspaceRoot, projectRoot)
        );
        if (
          !siblingFiles.includes('package.json') &&
          !siblingFiles.includes('project.json')
        ) {
          return null;
        }
        return { configFile, projectRoot };
      } catch (e) {
        preErrors.push([configFile, e as Error]);
        return null;
      }
    })
  );
  return {
    entries: candidates.filter((c): c is WebpackEntry => c !== null),
    preErrors,
  };
}

function normalizeOptions(
  options: WebpackPluginOptions
): Required<WebpackPluginOptions> {
  return {
    buildTargetName: options?.buildTargetName ?? 'build',
    serveTargetName: options?.serveTargetName ?? 'serve',
    serveStaticTargetName: options?.serveStaticTargetName ?? 'serve-static',
    previewTargetName: options?.previewTargetName ?? 'preview',
    buildDepsTargetName: 'build-deps',
    watchDepsTargetName: 'watch-deps',
  };
}
