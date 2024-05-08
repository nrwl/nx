import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { basename, dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import {
  type TargetConfiguration,
  type CreateDependencies,
  type CreateNodes,
  readJsonFile,
  writeJsonFile,
  detectPackageManager,
  CreateNodesContext,
  joinPathFragments,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { type RollupOptions } from 'rollup';

// This import causes an error due to the module resolution used. If we switch to bundler or nodenext in the future we remove this ignore.
// @ts-ignore
import { loadConfigFile } from 'rollup/loadConfigFile';

const cachePath = join(projectGraphCacheDirectory, 'rollup.hash');
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

export interface RollupPluginOptions {
  buildTargetName?: string;
}

export const createNodes: CreateNodes<RollupPluginOptions> = [
  '**/rollup.config.{js,cjs,mjs}',
  async (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);
    const fullyQualifiedProjectRoot = join(context.workspaceRoot, projectRoot);
    // Do not create a project if package.json and project.json do not exist
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
      : await buildRollupTarget(configFilePath, projectRoot, options, context);

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

async function buildRollupTarget(
  configFilePath: string,
  projectRoot: string,
  options: RollupPluginOptions,
  context: CreateNodesContext
): Promise<Record<string, TargetConfiguration>> {
  const namedInputs = getNamedInputs(projectRoot, context);
  const rollupConfig = (
    (await loadConfigFile(
      joinPathFragments(context.workspaceRoot, configFilePath)
    )) as { options: RollupOptions[] }
  ).options;
  const outputs = getOutputs(rollupConfig, projectRoot);

  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTargetName] = {
    command: `rollup -c ${basename(configFilePath)}`,
    options: { cwd: projectRoot },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
    ],
    outputs,
  };
  return targets;
}

function getOutputs(
  rollupConfigs: RollupOptions[],
  projectRoot: string
): string[] {
  const outputs = new Set<string>();
  for (const rollupConfig of rollupConfigs) {
    if (rollupConfig.output) {
      const rollupConfigOutputs = [];
      if (Array.isArray(rollupConfig.output)) {
        rollupConfigOutputs.push(...rollupConfig.output);
      } else {
        rollupConfigOutputs.push(rollupConfig.output);
      }

      for (const output of rollupConfigOutputs) {
        const outputPathFromConfig = output.dir
          ? output.dir
          : output.file
          ? dirname(output.file)
          : 'dist';
        const outputPath =
          projectRoot === '.'
            ? joinPathFragments(`{workspaceRoot}`, outputPathFromConfig)
            : joinPathFragments(
                `{workspaceRoot}`,
                projectRoot,
                outputPathFromConfig
              );
        outputs.add(outputPath);
      }
    }
  }
  return Array.from(outputs);
}

function normalizeOptions(options: RollupPluginOptions) {
  options ??= {};
  options.buildTargetName ??= 'build';

  return options;
}
