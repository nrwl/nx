import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/devkit-internals';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

export interface DetoxPluginOptions {
  buildTargetName?: string;
  startTargetName?: string;
  testTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

const pmc = getPackageManagerCommand();

function readTargetsCache(
  cachePath: string
): Record<string, Record<string, TargetConfiguration<DetoxPluginOptions>>> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  targetsCache: Record<
    string,
    Record<string, TargetConfiguration<DetoxPluginOptions>>
  >
) {
  const oldCache = readTargetsCache(cachePath);
  writeJsonFile(cachePath, {
    ...oldCache,
    targetsCache,
  });
}

export const createNodesV2: CreateNodesV2<DetoxPluginOptions> = [
  '**/{detox.config,.detoxrc}.{json,js}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `expo-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);

    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodes: CreateNodes<DetoxPluginOptions> = [
  '**/{detox.config,.detoxrc}.{json,js}',
  async (configFilePath, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `detox-${optionsHash}.hash`);

    const targetsCache = readTargetsCache(cachePath);
    const result = await createNodesInternal(
      configFilePath,
      options,
      context,
      targetsCache
    );

    writeTargetsToCache(cachePath, targetsCache);

    return result;
  },
];

async function createNodesInternal(
  configFile: string,
  options: DetoxPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<
    string,
    Record<string, TargetConfiguration<DetoxPluginOptions>>
  >
): Promise<CreateNodesResult> {
  options = normalizeOptions(options);
  const projectRoot = dirname(configFile);

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= buildDetoxTargets(projectRoot, options, context);

  return {
    projects: {
      [projectRoot]: {
        targets: targetsCache[hash],
      },
    },
  };
}

function buildDetoxTargets(
  projectRoot: string,
  options: DetoxPluginOptions,
  context: CreateNodesContext
) {
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {
    [options.buildTargetName]: {
      command: `detox build`,
      options: { cwd: projectRoot },
      cache: true,
      inputs: getInputs(namedInputs),
    },
    [options.startTargetName]: {
      command: `detox start`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.testTargetName]: {
      command: `detox test`,
      options: { cwd: projectRoot },
      cache: true,
      inputs: getInputs(namedInputs),
    },
  };

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return targets;
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs']
): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['detox'],
    },
  ];
}

function normalizeOptions(options: DetoxPluginOptions): DetoxPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.startTargetName ??= 'start';
  options.testTargetName ??= 'test';
  return options;
}
