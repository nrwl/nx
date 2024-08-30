import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/hasher/file-hasher';
import {
  type CreateDependencies,
  type CreateNodes,
  type CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
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
import { existsSync, readdirSync } from 'fs';

export interface RemixPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  startTargetName?: string;
  typecheckTargetName?: string;
  /**
   * @deprecated Use serveStaticTargetName instead. This option will be removed in Nx 21.
   */
  staticServeTargetName?: string;
  serveStaticTargetName?: string;
}
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

const remixConfigGlob = '**/{remix|vite}.config.{js,cjs,mjs}';

export const createNodesV2: CreateNodesV2<RemixPluginOptions> = [
  remixConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `remix-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFilePaths,
        options,
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
    return createNodesInternal(configFilePath, options, context, {});
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: RemixPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, RemixTargets>
) {
  const projectRoot = dirname(configFilePath);
  const fullyQualifiedProjectRoot = join(context.workspaceRoot, projectRoot);
  // Do not create a project if package.json and project.json isn't there
  const siblingFiles = readdirSync(fullyQualifiedProjectRoot);
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json') &&
    !siblingFiles.includes('vite.config.ts') &&
    !siblingFiles.includes('vite.config.js')
  ) {
    return {};
  }

  options = normalizeOptions(options);

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );
  targetsCache[hash] ??= await buildRemixTargets(
    configFilePath,
    projectRoot,
    options,
    context,
    siblingFiles
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
  siblingFiles: string[]
) {
  const namedInputs = getNamedInputs(projectRoot, context);
  const { buildDirectory, assetsBuildDirectory, serverBuildPath } =
    await getBuildPaths(configFilePath, context.workspaceRoot);

  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTargetName] = buildTarget(
    options.buildTargetName,
    projectRoot,
    buildDirectory,
    assetsBuildDirectory,
    namedInputs
  );
  targets[options.devTargetName] = devTarget(serverBuildPath, projectRoot);
  targets[options.startTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName
  );
  // TODO(colum): Remove for Nx 21
  targets[options.staticServeTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName
  );
  targets[options.serveStaticTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName
  );
  targets[options.typecheckTargetName] = typecheckTarget(
    projectRoot,
    namedInputs,
    siblingFiles
  );

  return targets;
}

function buildTarget(
  buildTargetName: string,
  projectRoot: string,
  buildDirectory: string,
  assetsBuildDirectory: string,
  namedInputs: { [inputName: string]: any[] }
): TargetConfiguration {
  const serverBuildOutputPath =
    projectRoot === '.'
      ? joinPathFragments(`{workspaceRoot}`, buildDirectory)
      : joinPathFragments(`{workspaceRoot}`, projectRoot, buildDirectory);

  const assetsBuildOutputPath =
    projectRoot === '.'
      ? joinPathFragments(`{workspaceRoot}`, assetsBuildDirectory)
      : joinPathFragments(`{workspaceRoot}`, projectRoot, assetsBuildDirectory);

  return {
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      { externalDependencies: ['@remix-run/dev'] },
    ],
    outputs: [serverBuildOutputPath, assetsBuildOutputPath],
    command: 'remix build',
    options: { cwd: projectRoot },
  };
}

function devTarget(
  serverBuildPath: string,
  projectRoot: string
): TargetConfiguration {
  return {
    command: 'remix dev --manual',
    options: { cwd: projectRoot },
  };
}

function startTarget(
  projectRoot: string,
  serverBuildPath: string,
  buildTargetName: string
): TargetConfiguration {
  return {
    dependsOn: [buildTargetName],
    command: `remix-serve ${serverBuildPath}`,
    options: {
      cwd: projectRoot,
    },
  };
}

function typecheckTarget(
  projectRoot: string,
  namedInputs: { [inputName: string]: any[] },
  siblingFiles: string[]
): TargetConfiguration {
  const hasTsConfigAppJson = siblingFiles.includes('tsconfig.app.json');
  const command = `tsc${
    hasTsConfigAppJson ? ` --project tsconfig.app.json` : ``
  }`;
  return {
    command,
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      { externalDependencies: ['typescript'] },
    ],
    options: {
      cwd: projectRoot,
    },
  };
}

async function getBuildPaths(
  configFilePath: string,
  workspaceRoot: string
): Promise<{
  buildDirectory: string;
  assetsBuildDirectory: string;
  serverBuildPath: string;
}> {
  const configPath = join(workspaceRoot, configFilePath);
  let appConfig = await loadConfigFile<AppConfig>(configPath);
  return {
    buildDirectory: 'build',
    serverBuildPath: appConfig.serverBuildPath ?? 'build/index.js',
    assetsBuildDirectory: appConfig.assetsBuildDirectory ?? 'public/build',
  };
}

function normalizeOptions(options: RemixPluginOptions) {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.devTargetName ??= 'dev';
  options.startTargetName ??= 'start';
  options.typecheckTargetName ??= 'typecheck';
  // TODO(colum): remove for Nx 21
  options.staticServeTargetName ??= 'static-serve';
  options.serveStaticTargetName ??= 'serve-static';

  return options;
}
