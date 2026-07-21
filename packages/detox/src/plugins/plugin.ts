import {
  getNamedInputs,
  calculateHashesForCreateNodes,
  PluginCache,
  workspaceDataDirectory,
  hashObject,
} from '@nx/devkit/internal';
import {
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodes,
  detectPackageManager,
  getPackageManagerCommand,
  NxJsonConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
import { addBuildAndWatchDepsTargets } from '@nx/js/internal';

export interface DetoxPluginOptions {
  buildTargetName?: string;
  startTargetName?: string;
  testTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type DetoxTargets = Record<string, TargetConfiguration<DetoxPluginOptions>>;

export const createNodes: CreateNodes<DetoxPluginOptions> = [
  '**/{detox.config,.detoxrc}.{json,js}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `detox-${optionsHash}.hash`);
    const targetsCache = new PluginCache<DetoxTargets>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);
    const normalizedOptions = normalizeOptions(options);

    try {
      const projectRoots = configFiles.map((f) => dirname(f));
      const projectHashes = await calculateHashesForCreateNodes(
        projectRoots,
        normalizedOptions,
        context,
        projectRoots.map(() => [lockFileName])
      );

      return await createNodesFromFiles(
        (configFile, _, ctx, idx) =>
          createNodesInternal(
            configFile,
            normalizedOptions,
            ctx,
            targetsCache,
            pmc,
            projectHashes[idx]
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
  context: CreateNodesContext,
  targetsCache: PluginCache<DetoxTargets>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  hash: string
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFile);

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
  context: CreateNodesContext,
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
