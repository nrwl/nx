import {
  emitPluginWorkerLog,
  evaluateUnderTaskEnv,
  getDaemonClientEnvGeneration,
  getGraphTimeDotEnvForTask,
  getNamedInputs,
  getReadyWhenHost,
  hashDaemonClientEnv,
  hashTaskDotEnvFiles,
  PluginCache,
  hashFile,
  hashObject,
  readEnv,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import {
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodes,
  detectPackageManager,
  PackageManager,
  ProjectConfiguration,
  readJsonFile,
  workspaceRoot,
  hashArray,
  getPackageManagerCommand,
  TargetConfiguration,
  normalizePath,
  joinPathFragments,
} from '@nx/devkit';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import {
  isUsingTsSolutionSetup,
  pnpmInstallSettingsInputsForInferredTarget,
  shouldIncludePnpmMajorRuntimeInput,
  addBuildAndWatchDepsTargets,
} from '@nx/js/internal';
import { existsSync, readdirSync } from 'fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'path';
import { readRspackOptions } from '../utils/read-rspack-options';
import { resolveUserDefinedRspackConfig } from '../utils/resolve-user-defined-rspack-config';
import { getRspackDevServerMajorVersion } from '../utils/version-utils';
import type { DevServerOptions } from './read-dev-server-options';
export interface RspackPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  previewTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type RspackTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

const rspackConfigGlob = '**/rspack.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodes: CreateNodes<RspackPluginOptions> = [
  rspackConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `rspack-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<RspackTargets>(cachePath);
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
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(
            configFile,
            options,
            context,
            targetsCache,
            isTsSolutionSetup,
            packageManager,
            pmc,
            lockFileName,
            includePnpmMajorRuntimeInput,
            ambientEnv,
            ambientEnvHash
          ),
        configFilePaths,
        options,
        context
      );
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

/**
 * @deprecated Use {@link createNodes} instead. This will be removed in Nx 24.
 */
export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFilePath: string,
  options: RspackPluginOptions,
  context: CreateNodesContext,
  targetsCache: PluginCache<RspackTargets>,
  isTsSolutionSetup: boolean,
  packageManager: PackageManager,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  lockFileName: string,
  includePnpmMajorRuntimeInput: boolean,
  ambientEnv: NodeJS.ProcessEnv,
  ambientEnvHash: string
) {
  const projectRoot = dirname(configFilePath);
  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  let packageJson = {};
  if (siblingFiles.includes('package.json')) {
    packageJson = readJsonFile(
      join(context.workspaceRoot, projectRoot, 'package.json')
    );
  }

  const normalizedOptions = normalizeOptions(options);

  const lockFileHash =
    hashFile(join(context.workspaceRoot, lockFileName)) ?? '';

  const nodeHash = hashArray([
    hashFile(join(context.workspaceRoot, configFilePath)),
    lockFileHash,
    hashObject({ ...options, isTsSolutionSetup, includePnpmMajorRuntimeInput }),
    hashObject(packageJson),
    ambientEnvHash,
    hashTaskDotEnvFiles(projectRoot, [
      normalizedOptions.serveTargetName,
      normalizedOptions.previewTargetName,
    ]),
  ]);
  // We do not want to alter how the hash is calculated, so appending the config file path to the hash
  // to prevent vite/vitest files overwriting the target cache created by the other
  const hash = `${nodeHash}_${configFilePath}`;

  let rspackTargets = targetsCache.get(hash);
  if (!rspackTargets) {
    const { devServerReadFailed, ...built } = await createRspackTargets(
      configFilePath,
      projectRoot,
      normalizedOptions,
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
    rspackTargets = built;
  }

  const { targets, metadata } = rspackTargets;

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets,
        metadata,
      },
    },
  };
}

async function createRspackTargets(
  configFilePath: string,
  projectRoot: string,
  options: RspackPluginOptions,
  context: CreateNodesContext,
  isTsSolutionSetup: boolean,
  packageManager: PackageManager,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  includePnpmMajorRuntimeInput: boolean,
  ambientEnv: NodeJS.ProcessEnv
): Promise<RspackTargets & { devServerReadFailed: boolean }> {
  const namedInputs = getNamedInputs(projectRoot, context);

  const rspackConfig = await resolveUserDefinedRspackConfig(
    join(context.workspaceRoot, configFilePath),
    getRootTsConfigPath(),
    true
  );

  const rspackOptions = await readRspackOptions(rspackConfig);

  const outputs = [];
  for (const config of rspackOptions) {
    if (config.output?.path) {
      outputs.push(normalizeOutputPath(config.output.path, projectRoot));
    }
  }

  const targets = {};

  const env: NodeJS.ProcessEnv = {};
  const isTsConfig = ['.ts', '.cts', '.mts'].includes(extname(configFilePath));
  if (isTsConfig) {
    // https://rspack.dev/config/#using-ts-node
    env['TS_NODE_COMPILER_OPTIONS'] = JSON.stringify({
      module: 'CommonJS',
      moduleResolution: 'Node10',
      customConditions: null,
    });
  }

  const buildInputs: TargetConfiguration['inputs'] = [
    ...('production' in namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['@rspack/cli'],
    },
  ];

  targets[options.buildTargetName] = {
    command: `rspack build`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=production'],
      env,
    },
    configurations: {
      development: {
        args: ['--node-env=development'],
      },
    },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs: [
      ...buildInputs,
      // The build can emit a pruned pnpm deploy output (NxAppRspackPlugin
      // with generatePackageJson), whose install settings come from these
      // otherwise-unhashed root sources.
      ...(packageManager === 'pnpm'
        ? pnpmInstallSettingsInputsForInferredTarget(
            includePnpmMajorRuntimeInput
          )
        : []),
    ],
    outputs,
  };

  targets[options.serveTargetName] = {
    continuous: true,
    inputs: [...buildInputs],
    command: `rspack serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=development'],
      env,
    },
  };

  targets[options.previewTargetName] = {
    continuous: true,
    inputs: [...buildInputs],
    command: `rspack serve`,
    options: {
      cwd: projectRoot,
      args: ['--node-env=production'],
      env,
    },
  };

  targets[options.serveStaticTargetName] = {
    dependsOn: [`${options.buildTargetName}`],
    continuous: true,
    readyWhen: { port: '{options.port}', host: '{options.host}' },
    inputs: [...buildInputs],
    executor: '@nx/web:file-server',
    options: {
      buildTarget: options.buildTargetName,
      spa: true,
    },
  };

  const devServerMajor = getRspackDevServerMajorVersion(
    join(context.workspaceRoot, projectRoot)
  );
  const devServerReads = await Promise.all(
    (
      [
        [options.serveTargetName, 'development'],
        [options.previewTargetName, 'production'],
      ] as const
    ).map(async ([targetName, nodeEnv]) => {
      const target = targets[targetName];
      try {
        const configs = await evaluateUnderTaskEnv<DevServerOptions[]>(
          require.resolve('./read-dev-server-options'),
          'readDevServerOptions',
          [
            join(context.workspaceRoot, configFilePath),
            getRootTsConfigPath(),
            nodeEnv,
          ],
          {
            cwd: join(context.workspaceRoot, target.options.cwd),
            env: getServeTaskEnv(
              projectRoot,
              targetName,
              target.options.env,
              nodeEnv,
              devServerMajor,
              ambientEnv
            ),
          }
        );
        const readyWhen = getDevServerReadyWhen(
          configs.find((config) => config.devServer)?.devServer,
          devServerMajor,
          logsInfrastructureInfo(configs)
        );
        if (readyWhen) {
          target.readyWhen = readyWhen;
        }
        return true;
      } catch (e) {
        emitPluginWorkerLog(
          'warn',
          `@nx/rspack: could not read the dev server options of ${configFilePath} under the ${targetName} task env, so no readyWhen is inferred for ${targetName}.\n${
            e instanceof Error ? e.message : String(e)
          }`
        );
        return false;
      }
    })
  );

  // for `convert-to-inferred` we need to leave the port undefined or the options will not match
  const serveStaticPort = getPortNumber(rspackConfig.devServer?.port);
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

function normalizeOptions(options: RspackPluginOptions): RspackPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.previewTargetName ??= 'preview';
  options.serveStaticTargetName ??= 'serve-static';
  return options;
}

function getServeTaskEnv(
  projectRoot: string,
  targetName: string,
  optionsEnv: Record<string, string>,
  nodeEnv: string,
  devServerMajor: number | null,
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
  // `--node-env` applies only when NODE_ENV is unset
  if (readEnv(env, 'NODE_ENV') === undefined) {
    env.NODE_ENV = nodeEnv;
  }
  // The dev server sets it as it loads, before the config runs. The major 1
  // one does it through webpack-dev-server.
  const serveFlag = devServerMajor === 1 ? 'WEBPACK_SERVE' : 'RSPACK_SERVE';
  if (!readEnv(env, serveFlag)) {
    env[serveFlag] = 'true';
  }
  return env;
}

function getDevServerReadyWhen(
  devServer: DevServerOptions['devServer'],
  devServerMajor: number | null,
  canMatchLog: boolean
): TargetConfiguration['readyWhen'] {
  // The dev server listens on a socket for any boolean ipc, false included,
  // and every major logs that socket once it listens
  const ipc = devServer?.ipc;
  if (typeof ipc === 'boolean' || (typeof ipc === 'string' && ipc)) {
    return canMatchLog ? { logMatches: 'Project is running at:' } : undefined;
  }
  // A NaN port comes from a value the task env leaves unset, so only the
  // address line logged after listen can tell the dev server is ready. An
  // unknown major gets no check, since waiting for a line it never logs fails
  // the task.
  if (Number.isNaN(devServer?.port)) {
    if (!canMatchLog) {
      return undefined;
    }
    if (devServerMajor === 1) {
      return { logMatches: 'Project is running at:' };
    }
    if (devServerMajor === 2) {
      return { logMatches: '  ➜  ' };
    }
    return undefined;
  }
  return {
    port: `{options.port ?? ${getDevServerPort(devServer?.port, devServerMajor)}}`,
    host: `{options.host ?? ${getReadyWhenHost(devServer?.host)}}`,
  };
}

// The dev servers log their address only when infrastructure logging includes
// the info level, and a custom console or stream can send it elsewhere
function logsInfrastructureInfo(configs: DevServerOptions[]): boolean {
  return configs.every(
    ({ infrastructureLogging: logging }) =>
      [undefined, 'info', 'log', 'verbose'].includes(logging.level) &&
      !logging.console &&
      !logging.stream
  );
}

// With the port unset or 'auto', the dev server picks a free one starting at
// its base port env var, else 8080. The rspack 1 dev server reads
// webpack-dev-server's env var.
function getDevServerPort(
  port: unknown,
  devServerMajor: number | null
): string {
  return port === undefined || port === null || port === 'auto'
    ? `env.${devServerMajor === 1 ? 'WEBPACK_DEV_SERVER_BASE_PORT' : 'RSPACK_DEV_SERVER_BASE_PORT'} ?? 8080`
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
    // If outputPath is undefined, use rspack's default `dist` directory.
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
