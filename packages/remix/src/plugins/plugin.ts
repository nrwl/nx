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
import { dirname, isAbsolute, join, relative } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { loadViteDynamicImport } from '../utils/executor-utils';

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

const remixConfigGlob = '**/{remix,vite}.config.{js,cjs,mjs,ts,cts,mts}';

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
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  options = normalizeOptions(options);

  const remixCompiler = determineIsRemixVite(
    configFilePath,
    context.workspaceRoot
  );

  if (remixCompiler === RemixCompiler.IsNotRemix) {
    return {};
  }

  const hash =
    (await calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ])) + configFilePath;

  targetsCache[hash] ??= await buildRemixTargets(
    configFilePath,
    projectRoot,
    options,
    context,
    siblingFiles,
    remixCompiler
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
  remixCompiler: RemixCompiler
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
    remixCompiler
  );
  targets[options.devTargetName] = devTarget(
    serverBuildPath,
    projectRoot,
    remixCompiler
  );
  targets[options.startTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName,
    remixCompiler
  );
  // TODO(colum): Remove for Nx 21
  targets[options.staticServeTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName,
    remixCompiler
  );
  targets[options.serveStaticTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName,
    remixCompiler
  );
  targets[options.typecheckTargetName] = typecheckTarget(
    projectRoot,
    namedInputs,
    siblingFiles
  );

  return { targets, metadata: {} };
}

function buildTarget(
  buildTargetName: string,
  projectRoot: string,
  buildDirectory: string,
  assetsBuildDirectory: string,
  namedInputs: { [inputName: string]: any[] },
  remixCompiler: RemixCompiler
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

  return {
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
}

function devTarget(
  serverBuildPath: string,
  projectRoot: string,
  remixCompiler: RemixCompiler
): TargetConfiguration {
  return {
    command:
      remixCompiler === RemixCompiler.IsVte
        ? 'remix vite:dev'
        : 'remix dev --manual',
    options: { cwd: projectRoot },
  };
}

function startTarget(
  projectRoot: string,
  serverBuildPath: string,
  buildTargetName: string,
  remixCompiler: RemixCompiler
): TargetConfiguration {
  let serverPath = serverBuildPath;
  if (remixCompiler === RemixCompiler.IsVte) {
    if (serverBuildPath === 'build') {
      serverPath = `${serverBuildPath}/server/index.js`;
    }
  }

  return {
    dependsOn: [buildTargetName],
    command: `remix-serve ${serverPath}`,
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
    const viteBuildConfig = await resolveConfig(
      {
        configFile: configPath,
        mode: 'development',
      },
      'build'
    );

    return {
      buildDirectory: viteBuildConfig.build?.outDir ?? 'build',
      serverBuildPath: viteBuildConfig.build?.outDir ?? 'build',
      assetsBuildDirectory: 'build/client',
    };
  }
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
