import {
  CreateDependencies,
  CreateNodes,
  CreateNodesV2,
  CreateNodesContext,
  detectPackageManager,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
  createNodesFromFiles,
  logger,
  getPackageManagerCommand,
} from '@nx/devkit';
import { dirname, join } from 'path';

import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';

import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { normalizeOptions } from 'nx/src/utils/normalize-options';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { hashObject } from 'nx/src/devkit-internals';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

export interface NextPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  startTargetName?: string;
  /**
   * @deprecated Use `startTargetName` instead.
   */
  serveStaticTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

const defaultOptions: NextPluginOptions = {
  buildTargetName: 'build',
  devTargetName: 'dev',
  startTargetName: 'start',
};

const pmc = getPackageManagerCommand();

const nextConfigBlob = '**/next.config.{ts,js,cjs,mjs}';

function readTargetsCache(
  cachePath: string
): Record<string, Record<string, TargetConfiguration<NextPluginOptions>>> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  targetsCache: Record<string, TargetConfiguration<NextPluginOptions>>
) {
  const oldCache = readTargetsCache(cachePath);
  writeJsonFile(cachePath, {
    ...oldCache,
    ...targetsCache,
  });
}

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

export const createNodesV2: CreateNodesV2<NextPluginOptions> = [
  nextConfigBlob,
  async (configFiles, options, context) => {
    const normalizedOptions = normalizeOptions(options, defaultOptions);
    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(workspaceDataDirectory, `next-${optionsHash}.json`);
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFiles,
        normalizedOptions,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

/**
 * @deprecated This is replaced with {@link createNodesV2}. Update your plugin to export its own `createNodesV2` function that wraps this one instead.
 * This function will change to the v2 function in Nx 21.
 */
export const createNodes: CreateNodes<NextPluginOptions> = [
  nextConfigBlob,
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 21, this will change to the createNodesV2 API.'
    );

    const normalizedOptions = normalizeOptions(options, defaultOptions);
    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(workspaceDataDirectory, `next-${optionsHash}.json`);
    const targetsCache = readTargetsCache(cachePath);

    const result = await createNodesInternal(
      configFilePath,
      normalizedOptions,
      context,
      targetsCache
    );
    writeTargetsToCache(cachePath, targetsCache);
    return result;
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: NextPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<
    string,
    Record<string, TargetConfiguration<NextPluginOptions>>
  >
) {
  const projectRoot = dirname(configFilePath);

  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
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

  targetsCache[hash] ??= await buildNextTargets(
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
}

async function buildNextTargets(
  nextConfigPath: string,
  projectRoot: string,
  options: NextPluginOptions,
  context: CreateNodesContext
) {
  const nextConfig = await getNextConfig(nextConfigPath, context);
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = await getBuildTargetConfig(
    namedInputs,
    projectRoot,
    nextConfig
  );

  targets[options.devTargetName] = getDevTargetConfig(projectRoot);

  const startTarget = getStartTargetConfig(options, projectRoot);

  targets[options.startTargetName] = startTarget;

  targets[options.serveStaticTargetName] = startTarget;

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return targets;
}

async function getBuildTargetConfig(
  namedInputs: { [inputName: string]: any[] },
  projectRoot: string,
  nextConfig: any
) {
  const nextOutputPath = await getOutputs(projectRoot, nextConfig);
  // Set output path here so that `withNx` can pick it up.
  const targetConfig: TargetConfiguration = {
    command: `next build`,
    options: {
      cwd: projectRoot,
    },
    dependsOn: ['^build'],
    cache: true,
    inputs: getInputs(namedInputs),
    outputs: [`${nextOutputPath}/!(cache)/**/*`, `${nextOutputPath}/!(cache)`],
  };

  // TODO(ndcunningham): Update this to be consider different versions of next.js which is running
  // This doesn't actually need to be tty, but next.js has a bug, https://github.com/vercel/next.js/issues/62906, where it exits 0 when SIGINT is sent.
  targetConfig.options.tty = false;

  return targetConfig;
}

function getDevTargetConfig(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    continuous: true,
    command: `next dev`,
    options: {
      cwd: projectRoot,
    },
  };

  return targetConfig;
}

function getStartTargetConfig(options: NextPluginOptions, projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    continuous: true,
    command: `next start`,
    options: {
      cwd: projectRoot,
    },
    dependsOn: [options.buildTargetName],
  };

  return targetConfig;
}

async function getOutputs(projectRoot, nextConfig) {
  let dir = '.next';
  const { PHASE_PRODUCTION_BUILD } = require('next/constants');

  if (typeof nextConfig === 'function') {
    // Works for both async and sync functions.
    const configResult = await Promise.resolve(
      nextConfig(PHASE_PRODUCTION_BUILD, { defaultConfig: {} })
    );
    if (configResult?.distDir) {
      dir = configResult?.distDir;
    }
  } else if (typeof nextConfig === 'object' && nextConfig?.distDir) {
    // If nextConfig is an object, directly use its 'distDir' property.
    dir = nextConfig.distDir;
  }

  if (projectRoot === '.') {
    return `{projectRoot}/${dir}`;
  } else {
    return `{workspaceRoot}/${projectRoot}/${dir}`;
  }
}

function getNextConfig(
  configFilePath: string,
  context: CreateNodesContext
): Promise<any> {
  const resolvedPath = join(context.workspaceRoot, configFilePath);

  return loadConfigFile(resolvedPath);
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs']
): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['next'],
    },
  ];
}
