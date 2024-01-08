import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import {
  type CreateDependencies,
  type CreateNodes,
  type CreateNodesContext,
  type TargetConfiguration,
  detectPackageManager,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName, getRootTsConfigPath } from '@nx/js';
import { registerTsProject } from '@nx/js/src/internal';
import { type AppConfig } from '@remix-run/dev';
import { join, dirname } from 'path';
import { existsSync, readdirSync } from 'fs';

const cachePath = join(projectGraphCacheDirectory, 'remix.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};
const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<string, Record<string, TargetConfiguration>>
) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export interface RemixPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  startTargetName?: string;
  typecheckTargetName?: string;
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
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    options = normalizeOptions(options);

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);
    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : await buildRemixTargets(configFilePath, projectRoot, options, context);

    calculatedTargets[hash] = targets;

    return {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets,
        },
      },
    };
  },
];

async function buildRemixTargets(
  configFilePath: string,
  projectRoot: string,
  options: RemixPluginOptions,
  context: CreateNodesContext
) {
  const namedInputs = getNamedInputs(projectRoot, context);
  const serverBuildPath = await getServerBuildPath(
    configFilePath,
    context.workspaceRoot
  );

  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTargetName] = buildTarget(
    options.buildTargetName,
    namedInputs
  );
  targets[options.serveTargetName] = serveTarget(serverBuildPath);
  targets[options.startTargetName] = startTarget(
    projectRoot,
    serverBuildPath,
    options.buildTargetName
  );
  targets[options.typecheckTargetName] = typecheckTarget(
    projectRoot,
    namedInputs
  );

  return targets;
}

function buildTarget(
  buildTargetName: string,
  namedInputs: { [inputName: string]: any[] }
): TargetConfiguration {
  return {
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
    ],
    outputs: ['{options.outputPath}'],
    executor: '@nx/remix:build',
    options: {
      outputPath: '{workspaceRoot}/dist',
    },
  };
}

function serveTarget(serverBuildPath: string): TargetConfiguration {
  return {
    executor: '@nx/remix:serve',
    options: {
      command: `npx remix-serve ${serverBuildPath}`,
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
    command: `npx remix-serve ${serverBuildPath}`,
    options: {
      cwd: projectRoot,
    },
  };
}

function typecheckTarget(
  projectRoot: string,
  namedInputs: { [inputName: string]: any[] }
): TargetConfiguration {
  return {
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
    ],
    command: 'tsc',
    options: {
      cwd: projectRoot,
    },
  };
}

async function getServerBuildPath(
  configFilePath: string,
  workspaceRoot: string
): Promise<string> {
  const configPath = join(workspaceRoot, configFilePath);
  let appConfig: AppConfig = {};
  try {
    let appConfigModule: any;
    try {
      appConfigModule = await Function(`return import("${configPath}")`)();
    } catch {
      appConfigModule = require(configPath);
    }

    appConfig = appConfigModule?.default || appConfigModule;
  } catch (error) {
    throw new Error(
      `Error loading Remix config at ${configFilePath}\n${String(error)}`
    );
  }

  return appConfig.serverBuildPath ?? 'build/index.js';
}

function normalizeOptions(options: RemixPluginOptions) {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.startTargetName ??= 'start';
  options.typecheckTargetName ??= 'typecheck';

  return options;
}
