import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/hasher/file-hasher';
import {
  type CreateDependencies,
  type CreateNodes,
  type CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { getLockFileName } from '@nx/js';
import { type AppConfig } from '@remix-run/dev';
import { dirname, join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';
import { isUsingTsSolutionSetup as _isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { normalizeOptions } from 'nx/src/utils/normalize-options';

export interface RemixPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  startTargetName?: string;
  typecheckTargetName?: string;
  serveStaticTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

const defaultOptions: RemixPluginOptions = {
  buildTargetName: 'build',
  devTargetName: 'dev',
  startTargetName: 'start',
  typecheckTargetName: 'typecheck',
  serveStaticTargetName: 'serve-static',
  buildDepsTargetName: 'build-deps',
  watchDepsTargetName: 'watch-deps',
};

const pmc = getPackageManagerCommand();

type RemixTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(
  cachePath: string
): Record<string, Record<string, TargetConfiguration>> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, RemixTargets>
) {
  writeJsonFile(cachePath, results);
}

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const remixConfigGlob = '**/{remix,vite}.config.{js,cjs,mjs,ts,cts,mts}';

export const createNodesV2: CreateNodesV2<RemixPluginOptions> = [
  remixConfigGlob,
  async (configFilePaths, options, context) => {
    const normalizedOptions = normalizeOptions(options, defaultOptions);
    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(workspaceDataDirectory, `remix-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);
    const isUsingTsSolutionSetup = _isUsingTsSolutionSetup();
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(
            configFile,
            options,
            context,
            targetsCache,
            isUsingTsSolutionSetup
          ),
        configFilePaths,
        normalizedOptions,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodes: CreateNodes<RemixPluginOptions> = [
  remixConfigGlob,
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    const normalizedOptions = normalizeOptions(options, defaultOptions);
    const isUsingTsSolutionSetup = _isUsingTsSolutionSetup();
    return createNodesInternal(
      configFilePath,
      normalizedOptions,
      context,
      {},
      isUsingTsSolutionSetup
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: RemixPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, RemixTargets>,
  isUsingTsSolutionSetup: boolean
) {
  const projectRoot = dirname(configFilePath);
  const fullyQualifiedProjectRoot = join(context.workspaceRoot, projectRoot);
  // Do not create a project if package.json and project.json isn't there
  const siblingFiles = readdirSync(fullyQualifiedProjectRoot);
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  const remixCompiler = determineIsRemixVite(
    configFilePath,
    context.workspaceRoot
  );

  if (remixCompiler === RemixCompiler.IsNotRemix) {
    return {};
  }

  const hash =
    (await calculateHashForCreateNodes(
      projectRoot,
      { ...options, isUsingTsSolutionSetup },
      context,
      [getLockFileName(detectPackageManager(context.workspaceRoot))]
    )) + configFilePath;

  targetsCache[hash] ??= await buildRemixTargets(
    configFilePath,
    projectRoot,
    options,
    context,
    siblingFiles,
    remixCompiler,
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

async function buildRemixTargets(
  configFilePath: string,
  projectRoot: string,
  options: RemixPluginOptions,
  context: CreateNodesContext,
  siblingFiles: string[],
  remixCompiler: RemixCompiler,
  isUsingTsSolutionSetup: boolean
) {
  const namedInputs = getNamedInputs(projectRoot, context);
  const { buildDirectory, assetsBuildDirectory, serverBuildPath } =
    await getBuildPaths(
      configFilePath,
      projectRoot,
      context.workspaceRoot,
      remixCompiler
    );

  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTargetName] = buildTarget(
    options.buildTargetName,
    projectRoot,
    buildDirectory,
    assetsBuildDirectory,
    namedInputs,
    remixCompiler,
    isUsingTsSolutionSetup
  );
  targets[options.devTargetName] = devTarget(
    serverBuildPath,
    projectRoot,
    remixCompiler,
    isUsingTsSolutionSetup
  );
  targets[options.startTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName,
    remixCompiler,
    isUsingTsSolutionSetup
  );
  targets[options.serveStaticTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName,
    remixCompiler,
    isUsingTsSolutionSetup
  );
  targets[options.typecheckTargetName] = typecheckTarget(
    options.typecheckTargetName,
    projectRoot,
    namedInputs,
    siblingFiles,
    isUsingTsSolutionSetup
  );

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return { targets, metadata: {} };
}

function buildTarget(
  buildTargetName: string,
  projectRoot: string,
  buildDirectory: string,
  assetsBuildDirectory: string,
  namedInputs: { [inputName: string]: any[] },
  remixCompiler: RemixCompiler,
  isUsingTsSolutionSetup: boolean
): TargetConfiguration {
  const serverBuildOutputPath =
    projectRoot === '.'
      ? joinPathFragments(`{workspaceRoot}`, buildDirectory)
      : joinPathFragments(`{workspaceRoot}`, projectRoot, buildDirectory);

  const assetsBuildOutputPath =
    projectRoot === '.'
      ? joinPathFragments(`{workspaceRoot}`, assetsBuildDirectory)
      : joinPathFragments(`{workspaceRoot}`, projectRoot, assetsBuildDirectory);

  const outputs =
    remixCompiler === RemixCompiler.IsVte
      ? [
          projectRoot === '.'
            ? joinPathFragments(`{workspaceRoot}`, buildDirectory)
            : joinPathFragments(`{workspaceRoot}`, projectRoot, buildDirectory),
        ]
      : [serverBuildOutputPath, assetsBuildOutputPath];

  const buildTarget: TargetConfiguration = {
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      { externalDependencies: ['@remix-run/dev'] },
    ],
    outputs,
    command:
      remixCompiler === RemixCompiler.IsVte
        ? 'remix vite:build'
        : 'remix build',
    options: { cwd: projectRoot },
  };

  if (isUsingTsSolutionSetup) {
    buildTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return buildTarget;
}

function devTarget(
  serverBuildPath: string,
  projectRoot: string,
  remixCompiler: RemixCompiler,
  isUsingTsSolutionSetup: boolean
): TargetConfiguration {
  const devTarget: TargetConfiguration = {
    continuous: true,
    command:
      remixCompiler === RemixCompiler.IsVte
        ? 'remix vite:dev'
        : 'remix dev --manual',
    options: { cwd: projectRoot },
  };

  if (isUsingTsSolutionSetup) {
    devTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return devTarget;
}

function startTarget(
  projectRoot: string,
  serverBuildPath: string,
  buildTargetName: string,
  remixCompiler: RemixCompiler,
  isUsingTsSolutionSetup: boolean
): TargetConfiguration {
  let serverPath = serverBuildPath;
  if (remixCompiler === RemixCompiler.IsVte) {
    if (serverBuildPath === 'build') {
      serverPath = `${serverBuildPath}/server/index.js`;
    }
  }

  const startTarget: TargetConfiguration = {
    dependsOn: [buildTargetName],
    continuous: true,
    command: `remix-serve ${serverPath}`,
    options: {
      cwd: projectRoot,
    },
  };

  if (isUsingTsSolutionSetup) {
    startTarget.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return startTarget;
}

function typecheckTarget(
  typecheckTargetName: string,
  projectRoot: string,
  namedInputs: { [inputName: string]: any[] },
  siblingFiles: string[],
  isUsingTsSolutionSetup: boolean
): TargetConfiguration {
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
          ? `${pmc.exec} tsc --build --help`
          : `${pmc.exec} tsc${
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

async function getBuildPaths(
  configFilePath: string,
  projectRoot: string,
  workspaceRoot: string,
  remixCompiler: RemixCompiler
): Promise<{
  buildDirectory: string;
  assetsBuildDirectory?: string;
  serverBuildPath?: string;
}> {
  const configPath = join(workspaceRoot, configFilePath);
  if (remixCompiler === RemixCompiler.IsClassic) {
    let appConfig = await loadConfigFile<AppConfig>(configPath);
    return {
      buildDirectory: 'build',
      serverBuildPath: appConfig.serverBuildPath ?? 'build/index.js',
      assetsBuildDirectory: appConfig.assetsBuildDirectory ?? 'public/build',
    };
  } else {
    // Workaround for the `build$3 is not a function` error that we sometimes see in agents.
    // This should be removed later once we address the issue properly
    try {
      const importEsbuild = () => new Function('return import("esbuild")')();
      await importEsbuild();
    } catch {
      // do nothing
    }
    const { resolveConfig } = await loadViteDynamicImport();
    const viteBuildConfig = (await resolveConfig(
      {
        configFile: configPath,
        mode: 'development',
      },
      'build'
    )) as any;

    return {
      buildDirectory: viteBuildConfig.build?.outDir ?? 'build',
      serverBuildPath: viteBuildConfig.build?.outDir
        ? join(
            dirname(viteBuildConfig.build?.outDir),
            `server/${viteBuildConfig.__remixPluginContext?.remixConfig.serverBuildFile}`
          )
        : 'build',
      assetsBuildDirectory: 'build/client',
    };
  }
}

function determineIsRemixVite(configFilePath: string, workspaceRoot: string) {
  if (configFilePath.includes('remix.config')) {
    return RemixCompiler.IsClassic;
  }

  const VITE_PLUGIN_REGEX = /vitePlugin\(\s*(.|\n)*?\s*\)/;
  const REMIX_PLUGIN_REGEX = /remix\(\s*(.|\n)*?\s*\)/;

  const fileContents = readFileSync(
    join(workspaceRoot, configFilePath),
    'utf8'
  );
  if (
    fileContents.includes('@remix-run/dev') &&
    (VITE_PLUGIN_REGEX.test(fileContents) ||
      REMIX_PLUGIN_REGEX.test(fileContents))
  ) {
    return RemixCompiler.IsVte;
  } else {
    return RemixCompiler.IsNotRemix;
  }
}

enum RemixCompiler {
  IsClassic = 1,
  IsVte = 2,
  IsNotRemix = 3,
}
