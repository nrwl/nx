import {
  calculateHashesForCreateNodes,
  emitPluginWorkerLog,
  evaluateUnderTaskEnv,
  getDaemonClientEnvGeneration,
  getGraphTimeDotEnvForTask,
  getNamedInputs,
  getReadyWhenHost,
  hashDaemonClientEnv,
  hashTaskDotEnvFiles,
  PluginCache,
  hashObject,
  readEnv,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesResultArray,
  CreateNodes,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  PackageManager,
  ProjectConfiguration,
  TargetConfiguration,
  workspaceRoot,
  normalizePath,
} from '@nx/devkit';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import {
  isUsingTsSolutionSetup,
  pnpmInstallSettingsInputsForInferredTarget,
  shouldIncludePnpmMajorRuntimeInput,
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  addBuildAndWatchDepsTargets,
} from '@nx/js/internal';
import { readdirSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { readWebpackOptions } from '../utils/webpack/read-webpack-options';
import { resolveUserDefinedWebpackConfig } from '../utils/webpack/resolve-user-defined-webpack-config';
import type { DevServerOptions } from './read-dev-server-options';
export interface WebpackPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  previewTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type WebpackTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

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
    const includePnpmMajorRuntimeInput = shouldIncludePnpmMajorRuntimeInput(
      packageManager,
      context.workspaceRoot
    );
    // The serve and preview task envs the dev server options are read under
    // build on this one. Snapshot it with its hash so a mid-pass change cannot
    // split them. An unset dotenv opt-out would be read from the live env, and
    // tasks get it set anyway.
    const ambientEnv = {
      ...process.env,
      NX_LOAD_DOT_ENV_FILES: process.env.NX_LOAD_DOT_ENV_FILES ?? 'true',
    };
    const ambientEnvHash = hashDaemonClientEnv();
    const ambientEnvGeneration = getDaemonClientEnvGeneration();

    try {
      const { entries, preErrors } = await filterWebpackConfigs(
        configFilePaths,
        context
      );

      const projectHashes = await calculateHashesForCreateNodes(
        entries.map((e) => e.projectRoot),
        { ...normalizedOptions, includePnpmMajorRuntimeInput, ambientEnvHash },
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
              packageManager,
              pmc,
              includePnpmMajorRuntimeInput,
              projectHashes[idx],
              ambientEnv
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
      // The build outputs are read under the live env, so entries built after
      // the daemon applied another client's env mid-pass would sit under the
      // wrong key
      if (getDaemonClientEnvGeneration() === ambientEnvGeneration) {
        targetsCache.writeToDisk();
      }
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
  packageManager: PackageManager,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  includePnpmMajorRuntimeInput: boolean,
  projectHash: string,
  ambientEnv: NodeJS.ProcessEnv
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFilePath);
  const hash = `${projectHash}-${hashTaskDotEnvFiles(projectRoot, [
    options.serveTargetName,
    options.previewTargetName,
  ])}`;

  let webpackTargets = targetsCache.get(hash);
  if (!webpackTargets) {
    const { devServerReadFailed, ...built } = await createWebpackTargets(
      configFilePath,
      projectRoot,
      options,
      context,
      isTsSolutionSetup,
      packageManager,
      pmc,
      includePnpmMajorRuntimeInput,
      ambientEnv
    );
    // Caching a failed read would make a transient failure, such as a
    // timeout, permanent
    if (!devServerReadFailed) {
      targetsCache.set(hash, built);
    }
    webpackTargets = built;
  }

  const { targets, metadata } = webpackTargets;

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
  packageManager: PackageManager,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  includePnpmMajorRuntimeInput: boolean,
  ambientEnv: NodeJS.ProcessEnv
): Promise<WebpackTargets & { devServerReadFailed: boolean }> {
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

  const buildInputs: TargetConfiguration['inputs'] = [
    ...('production' in namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['webpack-cli'],
    },
    TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  ];

  targets[options.buildTargetName] = {
    command: `webpack-cli build`,
    options: { cwd: projectRoot, env: { NODE_ENV: 'production' } },
    configurations: {
      development: {
        env: { NODE_ENV: 'development' },
      },
    },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs: [
      ...buildInputs,
      // The build can emit a pruned pnpm deploy output (NxAppWebpackPlugin
      // with generatePackageJson), whose install settings come from these
      // otherwise-unhashed root sources.
      ...(packageManager === 'pnpm'
        ? pnpmInstallSettingsInputsForInferredTarget(
            includePnpmMajorRuntimeInput
          )
        : []),
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
    inputs: [...buildInputs],
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
    inputs: [...buildInputs],
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
    readyWhen: { port: '{options.port}', host: '{options.host}' },
    inputs: [...buildInputs],
    dependsOn: [options.buildTargetName],
    executor: '@nx/web:file-server',
    options: {
      buildTarget: options.buildTargetName,
      spa: true,
    },
  };

  const devServerReads = await Promise.all(
    [options.serveTargetName, options.previewTargetName].map(
      async (targetName) => {
        const target = targets[targetName];
        try {
          const configs = await evaluateUnderTaskEnv<DevServerOptions[]>(
            require.resolve('./read-dev-server-options'),
            'readDevServerOptions',
            [
              join(context.workspaceRoot, configFilePath),
              getRootTsConfigPath(),
            ],
            {
              cwd: join(context.workspaceRoot, target.options.cwd),
              env: getServeTaskEnv(
                projectRoot,
                targetName,
                target.options.env,
                ambientEnv
              ),
            }
          );
          // webpack-cli starts the dev servers one after another, so the last
          // one listens only once all of them do
          const devServerConfigs = configs.filter((config) => config.devServer);
          const readyWhen = getDevServerReadyWhen(
            devServerConfigs.at(-1)?.devServer,
            // Each dev server logs its address, so with several the first line
            // comes before the last one listens
            devServerConfigs.length === 1 && logsInfrastructureInfo(configs)
          );
          if (readyWhen) {
            target.readyWhen = readyWhen;
          }
          return true;
        } catch (e) {
          emitPluginWorkerLog(
            'warn',
            `@nx/webpack: could not read the dev server options of ${configFilePath} under the ${targetName} task env, so no readyWhen is inferred for ${targetName}.\n${
              e instanceof Error ? e.message : String(e)
            }`
          );
          return false;
        }
      }
    )
  );

  // for `convert-to-inferred` we need to leave the port undefined or the options will not match
  const serveStaticPort = getPortNumber(webpackConfig.devServer?.port);
  if (serveStaticPort && serveStaticPort !== 4200) {
    targets[options.serveStaticTargetName].options.port = serveStaticPort;
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

  return {
    targets,
    metadata: {},
    devServerReadFailed: devServerReads.includes(false),
  };
}

function getServeTaskEnv(
  projectRoot: string,
  targetName: string,
  optionsEnv: Record<string, string>,
  ambientEnv: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  const env = {
    ...getGraphTimeDotEnvForTask(
      projectRoot,
      targetName,
      undefined,
      undefined,
      ambientEnv
    ),
    ...optionsEnv,
  };
  // webpack-dev-server sets it as it loads, before the config runs
  if (!readEnv(env, 'WEBPACK_SERVE')) {
    env.WEBPACK_SERVE = 'true';
  }
  return env;
}

function getDevServerReadyWhen(
  devServer: DevServerOptions['devServer'],
  canMatchLog: boolean
): TargetConfiguration['readyWhen'] {
  // An ipc socket or a NaN port (computed from a value the task env leaves unset)
  // leaves no port to check, but the dev server logs its address once it listens
  if (devServer?.ipc || Number.isNaN(devServer?.port)) {
    return canMatchLog ? { logMatches: 'Project is running at:' } : undefined;
  }
  return {
    port: `{options.port ?? ${getDevServerPort(devServer?.port)}}`,
    host: `{options.host ?? ${getReadyWhenHost(devServer?.host)}}`,
  };
}

// The dev server logs its address at the info level of webpack's
// infrastructure logger, and a custom console or stream sends it elsewhere
function logsInfrastructureInfo(configs: DevServerOptions[]): boolean {
  return configs.every(
    ({ infrastructureLogging: logging }) =>
      [undefined, 'info', 'log', 'verbose'].includes(logging.level) &&
      !logging.console &&
      !logging.stream
  );
}

// With the port unset or 'auto', the dev server picks a free one starting at
// this env var, else 8080
function getDevServerPort(port: unknown): string {
  return port === undefined || port === null || port === 'auto'
    ? 'env.WEBPACK_DEV_SERVER_BASE_PORT ?? 8080'
    : String(port);
}

// The file server takes a port number, so a value only the dev server
// understands, such as 'auto', leaves it on its default port
function getPortNumber(port: unknown): number | undefined {
  if (typeof port === 'number') {
    return port;
  }
  return typeof port === 'string' && /^\d+$/.test(port)
    ? Number(port)
    : undefined;
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
      return `{workspaceRoot}/${normalizePath(
        relative(workspaceRoot, resolve(workspaceRoot, outputPath))
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
