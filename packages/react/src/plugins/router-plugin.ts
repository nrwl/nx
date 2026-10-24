import {
  getNamedInputs,
  calculateHashesForCreateNodes,
  clearRequireCache,
  getReadyCheckReadyWhen,
  loadConfigFile,
  PluginCache,
  hashObject,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import {
  type CreateNodes,
  type CreateNodesContext,
  detectPackageManager,
  type TargetConfiguration,
  createNodesFromFiles,
  getPackageManagerCommand,
  joinPathFragments,
  type ProjectConfiguration,
} from '@nx/devkit';

import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { getLockFileName } from '@nx/js';
import {
  addBuildAndWatchDepsTargets,
  isUsingTsSolutionSetup as _isUsingTsSolutionSetup,
} from '@nx/js/internal';
import { canResolve } from './router-plugin-utils';
export interface ReactRouterPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  startTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type ReactRouterTargets = Pick<
  ProjectConfiguration,
  'targets' | 'metadata' | 'projectType'
>;

const reactRouterConfigBlob = '**/react-router.config.{ts,js,cjs,cts,mjs,mts}';

export const createNodes: CreateNodes<ReactRouterPluginOptions> = [
  reactRouterConfigBlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const normalizedOptions = normalizeOptions(options);
    const cachePath = join(
      workspaceDataDirectory,
      `react-router-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<ReactRouterTargets>(cachePath);

    const isUsingTsSolutionSetup = _isUsingTsSolutionSetup();

    const { roots: projectRoots, configFiles: validConfigFiles } =
      configFiles.reduce(
        (acc, configFile) => {
          const potentialRoot = dirname(configFile);
          if (checkIfConfigFileShouldBeProject(potentialRoot, context)) {
            acc.roots.push(potentialRoot);
            acc.configFiles.push(configFile);
          }
          return acc;
        },
        {
          roots: [],
          configFiles: [],
        } as {
          roots: string[];
          configFiles: string[];
        }
      );

    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmCommand = getPackageManagerCommand(packageManager);
    const lockfile = getLockFileName(packageManager);
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      { ...normalizedOptions, isUsingTsSolutionSetup },
      context,
      projectRoots.map((_) => [lockfile])
    );

    try {
      return await createNodesFromFiles(
        async (configFile, _, context, idx) => {
          const projectRoot = dirname(configFile);

          const hash = hashes[idx] + configFile;
          if (!targetsCache.has(hash)) {
            targetsCache.set(
              hash,
              await buildReactRouterTargets(
                configFile,
                projectRoot,
                normalizedOptions,
                context,
                isUsingTsSolutionSetup,
                pmCommand
              )
            );
          }
          const { projectType, metadata, targets } = targetsCache.get(hash);

          const project: ProjectConfiguration = {
            root: projectRoot,
            targets,
            metadata,
          };

          if (project.targets[normalizedOptions.buildTargetName]) {
            project.projectType = projectType;
          }

          return {
            projects: {
              [projectRoot]: project,
            },
          };
        },
        validConfigFiles,
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

async function buildReactRouterTargets(
  configFilePath: string,
  projectRoot: string,
  options: ReactRouterPluginOptions,
  context: CreateNodesContext,
  isUsingTsSolutionSetup: boolean,
  pmCommand: ReturnType<typeof getPackageManagerCommand>
): Promise<ReactRouterTargets> {
  const namedInputs = getNamedInputs(projectRoot, context);
  const configPath = join(context.workspaceRoot, configFilePath);

  if (require.cache[configPath]) clearRequireCache();
  const reactRouterConfig = await loadConfigFile(configPath);
  const isLibMode =
    reactRouterConfig?.ssr !== undefined && reactRouterConfig.ssr === false;

  const { buildDirectory, serverBuildPath } = await getBuildPaths(
    reactRouterConfig,
    isLibMode
  );

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = await getBuildTargetConfig(
    options.buildTargetName,
    projectRoot,
    buildDirectory,
    serverBuildPath,
    namedInputs,
    isUsingTsSolutionSetup
  );

  targets[options.devTargetName] = await devTarget(
    projectRoot,
    namedInputs,
    isUsingTsSolutionSetup,
    getDevReadyWhen(
      context.workspaceRoot,
      join(context.workspaceRoot, projectRoot)
    )
  );

  if (serverBuildPath) {
    targets[options.startTargetName] = await startTarget(
      projectRoot,
      serverBuildPath,
      options.buildTargetName,
      namedInputs,
      isUsingTsSolutionSetup
    );
  }

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmCommand
  );
  const metadata = {};
  return {
    targets,
    metadata,
    projectType: isLibMode ? 'library' : 'application',
  };
}

async function getBuildTargetConfig(
  buildTargetName: string,
  projectRoot: string,
  buildDirectory: string,
  serverBuildDirectory: string,
  namedInputs: { [inputName: string]: any[] },
  isUsingTsSolutionSetup: boolean
) {
  const basePath =
    projectRoot === '.'
      ? `{workspaceRoot}`
      : joinPathFragments(`{workspaceRoot}`, projectRoot);

  const outputs = [
    joinPathFragments(basePath, buildDirectory),
    ...(serverBuildDirectory
      ? [joinPathFragments(basePath, serverBuildDirectory)]
      : []),
  ];

  const buildTarget: TargetConfiguration = {
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: buildInputs(namedInputs),
    outputs,
    command: 'react-router build',
    options: { cwd: projectRoot },
  };

  if (isUsingTsSolutionSetup) {
    buildTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }
  return buildTarget;
}

async function getBuildPaths(reactRouterConfig, isLibMode: boolean) {
  return {
    buildDirectory: reactRouterConfig?.buildDirectory ?? 'build/client',
    ...(isLibMode
      ? undefined
      : {
          serverBuildPath: reactRouterConfig?.buildDirectory
            ? join(dirname(reactRouterConfig.buildDirectory), `server`)
            : 'build/server',
        }),
  };
}

function buildInputs(namedInputs: {
  [inputName: string]: any[];
}): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    { externalDependencies: ['@react-router/dev'] },
  ];
}

async function devTarget(
  projectRoot: string,
  namedInputs: { [inputName: string]: any[] },
  isUsingTsSolutionSetup: boolean,
  readyWhen: TargetConfiguration['readyWhen']
) {
  const devTarget: TargetConfiguration = {
    continuous: true,
    inputs: buildInputs(namedInputs),
    command: 'react-router dev',
    options: { cwd: projectRoot },
  };

  if (readyWhen) {
    devTarget.readyWhen = readyWhen;
  }

  if (isUsingTsSolutionSetup) {
    devTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }
  return devTarget;
}

// Vite's lookup order for the config in its root
const viteConfigFiles = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts',
];

// The Vite check resolves the config when the task runs, with the task's env
// and options, and waits for the server's port.
function getDevReadyWhen(
  workspaceRoot: string,
  absoluteProjectRoot: string
): TargetConfiguration['readyWhen'] {
  // `react-router dev` serves with the default Vite config of its cwd.
  const configFile = viteConfigFiles.find((file) =>
    existsSync(join(absoluteProjectRoot, file))
  );
  if (!configFile) {
    return undefined;
  }
  // Nx runs the check from the workspace root, where @nx/vite may be missing
  if (!canResolve('@nx/vite/ready-check', workspaceRoot)) {
    return undefined;
  }
  return getReadyCheckReadyWhen(
    '@nx/vite/ready-check',
    configFile,
    'react-router-dev'
  );
}

async function startTarget(
  projectRoot: string,
  serverBuildPath: string,
  buildTargetName: string,
  namedInputs: { [inputName: string]: any[] },
  isUsingTsSolutionSetup: boolean
) {
  const serverPath =
    serverBuildPath === 'build/server'
      ? `${serverBuildPath}/index.js`
      : serverBuildPath;

  const startTarget: TargetConfiguration = {
    continuous: true,
    dependsOn: [buildTargetName],
    inputs: buildInputs(namedInputs),
    command: `react-router-serve ${serverPath}`,
    options: { cwd: projectRoot },
    readyWhen: getReadyCheckReadyWhen('@nx/react/ready-check'),
  };

  if (isUsingTsSolutionSetup) {
    startTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }
  return startTarget;
}

function normalizeOptions(options: ReactRouterPluginOptions) {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.devTargetName ??= 'dev';
  options.startTargetName ??= 'start';

  return options;
}

function checkIfConfigFileShouldBeProject(
  projectRoot: string,
  context: CreateNodesContext
): boolean {
  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  return hasRequiredConfigs(siblingFiles);
}

function hasRequiredConfigs(files: string[]): boolean {
  const lowerFiles = files.map((file) => file.toLowerCase());

  // Check if vite.config.{ext} is present
  const hasViteConfig = lowerFiles.some((file) => {
    const parts = file.split('.');
    return parts[0] === 'vite' && parts[1] === 'config' && parts.length > 2;
  });

  if (!hasViteConfig) return false;

  const hasProjectOrPackageJson =
    lowerFiles.includes('project.json') || lowerFiles.includes('package.json');

  return hasProjectOrPackageJson;
}
