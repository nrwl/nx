import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import {
  type CreateDependencies,
  type CreateNodes,
  type CreateNodesContext,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName } from '@nx/js';
import { type AppConfig } from '@remix-run/dev';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import type { PackageManagerCommands } from 'nx/src/utils/package-manager';

const cachePath = join(workspaceDataDirectory, 'remix.hash');
const targetsCache = readTargetsCache();

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration>
> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache() {
  const oldCache = readTargetsCache();
  writeJsonFile(cachePath, {
    ...oldCache,
    ...targetsCache,
  });
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache();
  return [];
};

export interface RemixPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  startTargetName?: string;
  typecheckTargetName?: string;
  staticServeTargetName?: string;
}

export const createNodes: CreateNodes<RemixPluginOptions> = [
  '**/remix.config.{js,cjs,mjs}',
  async (configFilePath, options, context) => {
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

    return {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets: targetsCache[hash],
        },
      },
    };
  },
];

async function buildRemixTargets(
  configFilePath: string,
  projectRoot: string,
  options: RemixPluginOptions,
  context: CreateNodesContext,
  siblingFiles: string[]
) {
  const pmc = getPackageManagerCommand();
  const namedInputs = getNamedInputs(projectRoot, context);
  const { buildDirectory, assetsBuildDirectory, serverBuildPath } =
    await getBuildPaths(configFilePath, context.workspaceRoot);

  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTargetName] = buildTarget(
    options.buildTargetName,
    projectRoot,
    buildDirectory,
    assetsBuildDirectory,
    namedInputs,
    pmc
  );
  targets[options.devTargetName] = devTarget(serverBuildPath, projectRoot, pmc);
  targets[options.startTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName
  );
  targets[options.staticServeTargetName] = startTarget(
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
  namedInputs: { [inputName: string]: any[] },
  pmc: PackageManagerCommands
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
    metadata: {
      technologies: ['remix'],
      description: `Runs Remix build`,
      help: {
        command: `${pmc.exec} remix --help`,
        example: {
          options: {
            sourcemap: true,
          },
        },
      },
    },
  };
}

function devTarget(
  serverBuildPath: string,
  projectRoot: string,
  pmc: PackageManagerCommands
): TargetConfiguration {
  return {
    command: 'remix dev --manual',
    options: { cwd: projectRoot },
    metadata: {
      technologies: ['remix'],
      description: `Starts Remix dev server`,
      help: {
        command: `${pmc.exec} remix --help`,
        example: {
          options: {
            port: 3000,
          },
        },
      },
    },
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
  options.staticServeTargetName ??= 'static-serve';

  return options;
}
