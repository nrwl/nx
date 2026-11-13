import {
  getNamedInputs,
  calculateHashesForCreateNodes,
  clearRequireCache,
  getReadyCheckReadyWhen,
  retryOnRequireEsmRace,
  resolveInstalledPackage,
  loadConfigFile,
  PluginCache,
  hashObject,
  hashFile,
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
  readJsonFile,
  type ProjectConfiguration,
} from '@nx/devkit';

import { dirname, join, resolve } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { getLockFileName } from '@nx/js';
import {
  addBuildAndWatchDepsTargets,
  isUsingTsSolutionSetup as _isUsingTsSolutionSetup,
} from '@nx/js/internal';
import { resolveOptionalModule } from './router-plugin-utils';
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

type CachedReactRouterTargets = ReactRouterTargets & {
  configDependencyHashes: Record<string, string>;
};

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
    const targetsCache = new PluginCache<CachedReactRouterTargets>(cachePath);

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

    const configFileHashes = new Map<string, string | null>();
    const getConfigFileHash = (file: string) => {
      if (!configFileHashes.has(file)) {
        configFileHashes.set(file, hashFile(file) ?? null);
      }
      return configFileHashes.get(file) ?? null;
    };

    const getConfigDependencyHashes = (
      dependencies: string[],
      configLoadStartedAt: number
    ): Record<string, string> | undefined => {
      const hashes: Record<string, string> = {};
      try {
        for (const file of dependencies) {
          const hash = getConfigFileHash(file);
          if (hash === null) return undefined;
          const { mtimeMs, ctimeMs } = statSync(file);
          // Do not associate an earlier config result with newer file contents.
          if (
            mtimeMs >= configLoadStartedAt ||
            ctimeMs >= configLoadStartedAt
          ) {
            return undefined;
          }
          hashes[file] = hash;
        }
      } catch {
        return undefined;
      }
      return hashes;
    };

    try {
      return await createNodesFromFiles(
        async (configFile, _, context, idx) => {
          const projectRoot = dirname(configFile);

          const hash = hashes[idx] + configFile;
          const cachedTargets = targetsCache.get(hash);
          let result: ReactRouterTargets;
          if (
            cachedTargets?.configDependencyHashes &&
            Object.entries(cachedTargets.configDependencyHashes).every(
              ([file, previousHash]) => getConfigFileHash(file) === previousHash
            )
          ) {
            result = cachedTargets;
          } else {
            const configLoadStartedAt = Date.now();
            const { configDependencies, ...inferredTargets } =
              await buildReactRouterTargets(
                configFile,
                projectRoot,
                normalizedOptions,
                context,
                isUsingTsSolutionSetup,
                pmCommand
              );
            result = inferredTargets;
            const configDependencyHashes =
              configDependencies &&
              getConfigDependencyHashes(
                configDependencies,
                configLoadStartedAt
              );
            if (configDependencyHashes) {
              targetsCache.set(hash, { ...result, configDependencyHashes });
            }
          }
          const { projectType, metadata, targets } = result;

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
): Promise<ReactRouterTargets & { configDependencies?: string[] }> {
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

  const { readyWhen, configDependencies } = await getDevReadyWhen(
    context.workspaceRoot,
    join(context.workspaceRoot, projectRoot)
  );
  targets[options.devTargetName] = await devTarget(
    projectRoot,
    namedInputs,
    isUsingTsSolutionSetup,
    readyWhen
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
    configDependencies,
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

async function getDevReadyWhen(
  workspaceRoot: string,
  absoluteProjectRoot: string
): Promise<{
  readyWhen: TargetConfiguration['readyWhen'];
  configDependencies?: string[];
}> {
  // `react-router dev` serves with the default Vite config of its cwd.
  const configFile = viteConfigFiles.find((file) =>
    existsSync(join(absoluteProjectRoot, file))
  );
  if (!configFile) {
    return { readyWhen: undefined, configDependencies: [] };
  }
  // The command check runs from the workspace root and must resolve its helper there.
  const viteReadyCheck = resolveOptionalModule(
    '@nx/vite/ready-check',
    workspaceRoot
  );
  if (!viteReadyCheck) {
    return { readyWhen: undefined, configDependencies: [] };
  }
  const commandReadyWhen = getReadyCheckReadyWhen(
    '@nx/vite/ready-check',
    configFile,
    'react-router-dev'
  );
  try {
    let vitePackageJsonPath: string;
    try {
      vitePackageJsonPath = resolveInstalledPackage(
        'vite/package.json',
        [absoluteProjectRoot, dirname(viteReadyCheck)],
        workspaceRoot
      );
    } catch {
      // A linked @nx/vite may keep Vite in its own package directory.
      const nxVitePackageJsonPath = resolveInstalledPackage(
        '@nx/vite/package.json',
        [workspaceRoot],
        workspaceRoot
      );
      vitePackageJsonPath = resolveInstalledPackage(
        'vite/package.json',
        [dirname(viteReadyCheck)],
        dirname(nxVitePackageJsonPath)
      );
    }
    const viteExport = readJsonFile(vitePackageJsonPath).exports['.'];
    // Vite 5/6 expose a deprecated CJS shim under the require condition.
    const esmEntry =
      typeof viteExport === 'string'
        ? viteExport
        : (viteExport.import?.default ?? viteExport.import);
    const { loadConfigFromFile } = await import(
      pathToFileURL(join(dirname(vitePackageJsonPath), esmEntry)).href
    );
    // Resolving serve plugins starts React Router's type generator. Loading only
    // the config avoids a second generator deleting files the server is writing.
    const viteConfig = await retryOnRequireEsmRace<{
      config: { plugins?: unknown };
      dependencies: string[];
    } | null>(() =>
      loadConfigFromFile(
        {
          command: 'serve',
          mode: 'development',
          isSsrBuild: false,
          isPreview: false,
        },
        join(absoluteProjectRoot, configFile),
        absoluteProjectRoot,
        'silent'
      )
    );
    return {
      readyWhen: (await loadsReadySignalPlugin(viteConfig?.config.plugins))
        ? { signal: true }
        : commandReadyWhen,
      configDependencies: viteConfig
        ? [...new Set(viteConfig.dependencies.map((file) => resolve(file)))]
        : undefined,
    };
  } catch {
    // Optional readiness detection must not prevent graph creation.
  }
  return { readyWhen: commandReadyWhen };
}

async function loadsReadySignalPlugin(plugins: unknown): Promise<boolean> {
  const plugin = await plugins;
  if (Array.isArray(plugin)) {
    return (await Promise.all(plugin.map(loadsReadySignalPlugin))).some(
      Boolean
    );
  }
  const candidate = plugin as { name?: unknown; apply?: unknown } | null;
  // Function predicates may depend on the task environment.
  return (
    candidate?.name === 'nx-ready-signal' &&
    (!candidate.apply || candidate.apply === 'serve')
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
