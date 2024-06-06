import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { basename, dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import {
  type CreateDependencies,
  type CreateNodes,
  CreateNodesContext,
  detectPackageManager,
  joinPathFragments,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { type RollupOptions } from 'rollup';

const cachePath = join(workspaceDataDirectory, 'rollup.hash');
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

    const hash = await calculateHashForCreateNodes(
      projectRoot,
      options,
      context,
      [getLockFileName(detectPackageManager(context.workspaceRoot))]
    );

    targetsCache[hash] ??= await buildRollupTarget(
      configFilePath,
      projectRoot,
      options,
      context
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

async function buildRollupTarget(
  configFilePath: string,
  projectRoot: string,
  options: RollupPluginOptions,
  context: CreateNodesContext
): Promise<Record<string, TargetConfiguration>> {
  let loadConfigFile: (
    path: string,
    commandOptions: unknown,
    watchMode: boolean
  ) => Promise<{ options: RollupOptions[] }>;

  try {
    // Try to load the workspace version of rollup first (it should already exist).
    // Using the workspace rollup ensures that the config file is compatible with the `loadConfigFile` function.
    // e.g. rollup@2 supports having `require` calls in rollup config, but rollup@4 does not.
    const m = require(require.resolve('rollup/loadConfigFile', {
      paths: [dirname(configFilePath)],
    }));
    // Rollup 2 has this has default export, but it is named in 3 and 4.
    // See: https://www.unpkg.com/browse/rollup@2.79.1/dist/loadConfigFile.js
    loadConfigFile = typeof m === 'function' ? m : m.loadConfigFile;
  } catch {
    // Fallback to our own if needed.
    loadConfigFile = require('rollup/loadConfigFile').loadConfigFile;
  }

  const namedInputs = getNamedInputs(projectRoot, context);
  const rollupConfig = (
    (await loadConfigFile(
      joinPathFragments(context.workspaceRoot, configFilePath),
      {},
      true // Enable watch mode so that rollup properly reloads config files without reusing a cached version
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
      { externalDependencies: ['rollup'] },
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
