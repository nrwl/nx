import {
  getNamedInputs,
  getReadyWhenHost,
  PluginCache,
  hashFile,
  hashObject,
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
import { isNxRspackComposablePlugin } from '../utils/config';
import { readRspackOptions } from '../utils/read-rspack-options';
import { resolveUserDefinedRspackConfig } from '../utils/resolve-user-defined-rspack-config';
import { getRspackDevServerMajorVersion } from '../utils/version-utils';
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
            includePnpmMajorRuntimeInput
          ),
        configFilePaths,
        options,
        context
      );
    } finally {
      targetsCache.writeToDisk();
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
  includePnpmMajorRuntimeInput: boolean
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
  ]);
  // We do not want to alter how the hash is calculated, so appending the config file path to the hash
  // to prevent vite/vitest files overwriting the target cache created by the other
  const hash = `${nodeHash}_${configFilePath}`;

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      await createRspackTargets(
        configFilePath,
        projectRoot,
        normalizedOptions,
        context,
        isTsSolutionSetup,
        packageManager,
        pmc,
        includePnpmMajorRuntimeInput
      )
    );
  }

  const { targets, metadata } = targetsCache.get(hash);

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
  includePnpmMajorRuntimeInput: boolean
): Promise<RspackTargets> {
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

  // rspack serve calls a function config with its serve env
  const serveOptions = takesEnv(rspackConfig)
    ? await readRspackOptions(rspackConfig, { RSPACK_SERVE: true })
    : rspackOptions;
  const devServer = serveOptions.find((config) => config.devServer)?.devServer;
  // The rspack 1 dev server reads webpack-dev-server's env var
  const devServerReadyWhen = getDevServerReadyWhen(
    devServer || undefined,
    getRspackDevServerMajorVersion(join(context.workspaceRoot, projectRoot)) ===
      1
      ? 'WEBPACK_DEV_SERVER_BASE_PORT'
      : 'RSPACK_DEV_SERVER_BASE_PORT'
  );

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
    ...(devServerReadyWhen && { readyWhen: devServerReadyWhen }),
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
    ...(devServerReadyWhen && { readyWhen: devServerReadyWhen }),
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

  return { targets, metadata: {} };
}

function normalizeOptions(options: RspackPluginOptions): RspackPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.previewTargetName ??= 'preview';
  options.serveStaticTargetName ??= 'serve-static';
  return options;
}

function takesEnv(config: unknown): boolean {
  return Array.isArray(config)
    ? config.some(takesEnv)
    : typeof config === 'function' && !isNxRspackComposablePlugin(config);
}

function getDevServerReadyWhen(
  devServer: { port?: unknown; host?: unknown; ipc?: unknown } | undefined,
  basePortEnv: string
): TargetConfiguration['readyWhen'] {
  // The dev server listens on a socket for any boolean ipc, false included,
  // and no probe can check a socket
  const ipc = devServer?.ipc;
  if (typeof ipc === 'boolean' || (typeof ipc === 'string' && ipc)) {
    return undefined;
  }
  return {
    port: `{options.port ?? ${getDevServerPort(devServer?.port, basePortEnv)}}`,
    host: `{options.host ?? ${getReadyWhenHost(devServer?.host)}}`,
  };
}

// With the port unset or 'auto', the dev server picks a free one starting at
// this env var, else 8080
function getDevServerPort(port: unknown, basePortEnv: string): string {
  return port === undefined || port === null || port === 'auto'
    ? `env.${basePortEnv} ?? 8080`
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
