import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { basename, dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import {
  type CreateDependencies,
  type CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { type RollupOptions } from 'rollup';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

const pmc = getPackageManagerCommand();

function readTargetsCache(
  cachePath: string
): Record<string, Record<string, TargetConfiguration>> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, Record<string, TargetConfiguration>>
) {
  writeJsonFile(cachePath, results);
}

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

export interface RollupPluginOptions {
  buildTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

const rollupConfigGlob = '**/rollup.config.{js,cjs,mjs,ts,cts,mts}';

export const createNodes: CreateNodes<RollupPluginOptions> = [
  rollupConfigGlob,
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    return createNodesInternal(
      configFilePath,
      normalizeOptions(options),
      context,
      {},
      isUsingTsSolutionSetup()
    );
  },
];

export const createNodesV2: CreateNodesV2<RollupPluginOptions> = [
  rollupConfigGlob,
  async (configFilePaths, options, context) => {
    const normalizedOptions = normalizeOptions(options);
    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(
      workspaceDataDirectory,
      `rollup-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    const isTsSolutionSetup = isUsingTsSolutionSetup();

    try {
      return await createNodesFromFiles(
        (configFile, _, context) =>
          createNodesInternal(
            configFile,
            normalizedOptions,
            context,
            targetsCache,
            isTsSolutionSetup
          ),
        configFilePaths,
        normalizedOptions,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: Required<RollupPluginOptions>,
  context: CreateNodesContext,
  targetsCache: Record<string, Record<string, TargetConfiguration>>,
  isTsSolutionSetup: boolean
) {
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
    context,
    isTsSolutionSetup
  );

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets: targetsCache[hash],
      },
    },
  };
}

async function buildRollupTarget(
  configFilePath: string,
  projectRoot: string,
  options: RollupPluginOptions,
  context: CreateNodesContext,
  isTsSolutionSetup: boolean
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

  const isTsConfig = configFilePath.endsWith('ts');
  const tsConfigPlugin = '@rollup/plugin-typescript';
  const namedInputs = getNamedInputs(projectRoot, context);
  const rollupConfig = (
    (await loadConfigFile(
      joinPathFragments(context.workspaceRoot, configFilePath),
      isTsConfig ? { configPlugin: tsConfigPlugin } : {},
      true // Enable watch mode so that rollup properly reloads config files without reusing a cached version
    )) as { options: RollupOptions[] }
  ).options;
  const outputs = getOutputs(rollupConfig, projectRoot);

  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTargetName] = {
    command: `rollup -c ${basename(configFilePath)}${
      isTsConfig
        ? ` --configPlugin typescript={tsconfig:\\'tsconfig.lib.json\\'}`
        : ''
    }`,
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
    metadata: {
      technologies: ['rollup'],
      description: 'Run Rollup',
      help: {
        command: `${pmc.exec} rollup --help`,
        example: {
          options: {
            sourcemap: true,
            watch: true,
          },
        },
      },
    },
  };

  if (isTsSolutionSetup) {
    targets[options.buildTargetName].syncGenerators = [
      '@nx/js:typescript-sync',
    ];
  }

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

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

function normalizeOptions(
  options: RollupPluginOptions
): Required<RollupPluginOptions> {
  return {
    buildTargetName: options.buildTargetName ?? 'build',
    buildDepsTargetName: options.buildDepsTargetName ?? 'build-deps',
    watchDepsTargetName: options.watchDepsTargetName ?? 'watch-deps',
  };
}
