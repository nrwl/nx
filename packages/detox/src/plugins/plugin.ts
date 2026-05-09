import {
  getNamedInputs,
  calculateHashForCreateNodes,
  PluginCache,
} from '@nx/devkit/internal';
import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  NxJsonConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
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

type DetoxTargets = Record<string, TargetConfiguration<DetoxPluginOptions>>;

export const createNodes: CreateNodesV2<DetoxPluginOptions> = [
  '**/{detox.config,.detoxrc}.{json,js}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `detox-${optionsHash}.hash`);
    const targetsCache = new PluginCache<DetoxTargets>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);

    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(
            configFile,
            options,
            context,
            targetsCache,
            pmc,
            lockFileName
          ),
        configFiles,
        options,
        context
      );
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFile: string,
  options: DetoxPluginOptions,
  context: CreateNodesContextV2,
  targetsCache: PluginCache<DetoxTargets>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  lockFileName: string
): Promise<CreateNodesResult> {
  options = normalizeOptions(options);
  const projectRoot = dirname(configFile);

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [lockFileName]
  );

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      buildDetoxTargets(projectRoot, options, context, pmc)
    );
  }

  return {
    projects: {
      [projectRoot]: {
        targets: targetsCache.get(hash),
      },
    },
  };
}

function buildDetoxTargets(
  projectRoot: string,
  options: DetoxPluginOptions,
  context: CreateNodesContextV2,
  pmc: ReturnType<typeof getPackageManagerCommand>
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
