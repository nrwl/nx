import {
  CreateNodesV2,
  CreateNodesContext,
  detectPackageManager,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
  createNodesFromFiles,
  getPackageManagerCommand,
  joinPathFragments,
  type ProjectConfiguration,
} from '@nx/devkit';

import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
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

type ReactRouterTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

const pmCommand = getPackageManagerCommand();
const reactRouterConfigBlob = '**/react-router.config.{ts,js,cjs,cts,mjs,mts}';

function readTargetsCache(
  cachePath: string
): Record<string, Record<string, TargetConfiguration>> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
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
    const cachePath = join(
      workspaceDataDirectory,
      `react-router-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(
            configFile,
            options,
            context,
            targetsCache,
            _isUsingTsSolutionSetup()
          ),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

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

async function createNodesInternal(
  configFilePath: string,
  options: ReactRouterPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, ReactRouterTargets>,
  isUsingTsSolutionSetup: boolean
) {
  const projectRoot = dirname(configFilePath);
  const resolveProjectRoot = joinPathFragments(
    context.workspaceRoot,
    projectRoot
  );

  const siblingFiles = readdirSync(resolveProjectRoot);
  if (!hasRequiredConfigs(siblingFiles)) {
    return {};
  }

  options = normalizeOptions(options);

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    { ...options, isUsingTsSolutionSetup },
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= await buildReactRouterTargets(
    configFilePath,
    projectRoot,
    options,
    context,
    siblingFiles,
    isUsingTsSolutionSetup
  );

  const { targets, metadata } = targetsCache[hash];

  const project: ProjectConfiguration = {
    root: projectRoot,
    targets,
    metadata,
  };

  return {
    projects: {
      [projectRoot]: project,
    },
  };
}

async function buildReactRouterTargets(
  configFilePath: string,
  projectRoot: string,
  options: ReactRouterPluginOptions,
  context: CreateNodesContext,
  siblingFiles: string[],
  isUsingTsSolutionSetup: boolean
) {
  const namedInputs = getNamedInputs(projectRoot, context);
  const { buildDirectory, serverBuildPath } = await getBuildPaths(
    configFilePath,
    context
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

  return { targets, metadata: {} };
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

async function getBuildPaths(
  configFilePath: string,
  context: CreateNodesContext
) {
  const configPath = join(context.workspaceRoot, configFilePath);

  if (require.cache[configPath]) clearRequireCache();
  const reactRouterConfig = await loadConfigFile(configPath);

  const isLibMode =
    reactRouterConfig?.ssr !== undefined && reactRouterConfig.ssr === false;
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
