import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  detectPackageManager,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';

export interface DetoxPluginOptions {
  buildTargetName?: string;
  startTargetName?: string;
  testTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'detox.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration<DetoxPluginOptions>>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<
    string,
    Record<string, TargetConfiguration<DetoxPluginOptions>>
  >
) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<DetoxPluginOptions> = [
  '**/{detox.config,.detoxrc}.{json,js}',
  (configFilePath, options, context) => {
    options = normalizeOptions(options);
    const projectRoot = dirname(configFilePath);

    // Do not create a project if project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (!siblingFiles.includes('project.json')) {
      return {};
    }

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);

    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : buildDetoxTargets(projectRoot, options, context);

    calculatedTargets[hash] = targets;

    return {
      projects: {
        [projectRoot]: {
          targets,
        },
      },
    };
  },
];

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
      options: { cwd: projectRoot },
    },
    [options.testTargetName]: {
      command: `detox test`,
      options: { cwd: projectRoot },
      cache: true,
      inputs: getInputs(namedInputs),
    },
  };

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
