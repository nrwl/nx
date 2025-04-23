import {
  type CreateNodesV2,
  type CreateNodesContext,
  detectPackageManager,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
  createNodesFromFiles,
  getPackageManagerCommand,
  joinPathFragments,
  type ProjectConfiguration,
  type CreateNodesContextV2,
} from '@nx/devkit';

import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { hashObject } from 'nx/src/devkit-internals';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';
import { isUsingTsSolutionSetup as _isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import {
  clearRequireCache,
  loadConfigFile,
} from '@nx/devkit/src/utils/config-utils';

export interface ReactRouterPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  startTargetName?: string;
  typecheckTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type ReactRouterTargets = Pick<
  ProjectConfiguration,
  'targets' | 'metadata' | 'projectType'
>;

const pmCommand = getPackageManagerCommand();
const reactRouterConfigBlob = '**/react-router.config.{ts,js,cjs,cts,mjs,mts}';

function readTargetsCache(
  cachePath: string
): Record<string, ReactRouterTargets> {
  return process.env.NX_CACHE_PROJECT_GRAPH !== 'false' && existsSync(cachePath)
    ? readJsonFile(cachePath)
    : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, ReactRouterTargets>
) {
  writeJsonFile(cachePath, results);
}

export const createNodesV2: CreateNodesV2<ReactRouterPluginOptions> = [
  reactRouterConfigBlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const normalizedOptions = normalizeOptions(options);
    const cachePath = join(
      workspaceDataDirectory,
      `react-router-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

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

    const lockfile = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
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

          const siblingFiles = readdirSync(
            joinPathFragments(context.workspaceRoot, projectRoot)
          );

          const hash = hashes[idx] + configFile;
          const { projectType, metadata, targets } = (targetsCache[hash] ??=
            await buildReactRouterTargets(
              configFile,
              projectRoot,
              normalizedOptions,
              context,
              siblingFiles,
              isUsingTsSolutionSetup
            ));

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
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

async function buildReactRouterTargets(
  configFilePath: string,
  projectRoot: string,
  options: ReactRouterPluginOptions,
  context: CreateNodesContext,
  siblingFiles: string[],
  isUsingTsSolutionSetup: boolean
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
    isUsingTsSolutionSetup
  );

  if (serverBuildPath) {
    targets[options.startTargetName] = await startTarget(
      projectRoot,
      serverBuildPath,
      options.buildTargetName,
      isUsingTsSolutionSetup
    );
  }

  targets[options.typecheckTargetName] = await typecheckTarget(
    projectRoot,
    options.typecheckTargetName,
    namedInputs,
    siblingFiles,
    isUsingTsSolutionSetup
  );

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
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      { externalDependencies: ['@react-router/dev'] },
    ],
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

async function devTarget(projectRoot: string, isUsingTsSolutionSetup: boolean) {
  const devTarget: TargetConfiguration = {
    continuous: true,
    command: 'react-router dev',
    options: { cwd: projectRoot },
  };

  if (isUsingTsSolutionSetup) {
    devTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }
  return devTarget;
}

async function startTarget(
  projectRoot: string,
  serverBuildPath: string,
  buildTargetName: string,
  isUsingTsSolutionSetup: boolean
) {
  const serverPath =
    serverBuildPath === 'build/server'
      ? `${serverBuildPath}/index.js`
      : serverBuildPath;

  const startTarget: TargetConfiguration = {
    continuous: true,
    dependsOn: [buildTargetName],
    command: `react-router-serve ${serverPath}`,
    options: { cwd: projectRoot },
  };

  if (isUsingTsSolutionSetup) {
    startTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }
  return startTarget;
}

async function typecheckTarget(
  projectRoot: string,
  typecheckTargetName: string,
  namedInputs: { [inputName: string]: any[] },
  siblingFiles: string[],
  isUsingTsSolutionSetup: boolean
) {
  const hasTsConfigAppJson = siblingFiles.includes('tsconfig.app.json');
  const typecheckTarget: TargetConfiguration = {
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      { externalDependencies: ['typescript'] },
    ],
    command: isUsingTsSolutionSetup
      ? `tsc --build --emitDeclarationOnly`
      : `tsc${hasTsConfigAppJson ? ` -p tsconfig.app.json` : ``} --noEmit`,
    options: {
      cwd: projectRoot,
    },
    metadata: {
      description: `Runs type-checking for the project.`,
      technologies: ['typescript'],
      help: {
        command: isUsingTsSolutionSetup
          ? `${pmCommand.exec} tsc --build --help`
          : `${pmCommand.exec} tsc${
              hasTsConfigAppJson ? ` -p tsconfig.app.json` : ``
            } --help`,
        example: isUsingTsSolutionSetup
          ? { args: ['--force'] }
          : { options: { noEmit: true } },
      },
    },
  };

  if (isUsingTsSolutionSetup) {
    typecheckTarget.dependsOn = [`^${typecheckTargetName}`];
    typecheckTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }
  return typecheckTarget;
}

function normalizeOptions(options: ReactRouterPluginOptions) {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.devTargetName ??= 'dev';
  options.startTargetName ??= 'start';
  options.typecheckTargetName ??= 'typecheck';

  return options;
}

function checkIfConfigFileShouldBeProject(
  projectRoot: string,
  context: CreateNodesContext | CreateNodesContextV2
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
