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

import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';

import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface NextPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  startTargetName?: string;
  serveStaticTargetName?: string;
}

const cachePath = join(workspaceDataDirectory, 'next.hash');
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

export const createNodes: CreateNodes<NextPluginOptions> = [
  '**/next.config.{js,cjs,mjs}',
  async (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
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
  },
];

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

  targets[options.startTargetName] = getStartTargetConfig(options, projectRoot);

  targets[options.serveStaticTargetName] = getStaticServeTargetConfig(options);

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
    outputs: [nextOutputPath, `${nextOutputPath}/!(cache)`],
  };

  // TODO(ndcunningham): Update this to be consider different versions of next.js which is running
  // This doesn't actually need to be tty, but next.js has a bug, https://github.com/vercel/next.js/issues/62906, where it exits 0 when SIGINT is sent.
  targetConfig.options.tty = false;

  return targetConfig;
}

function getDevTargetConfig(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `next dev`,
    options: {
      cwd: projectRoot,
    },
  };

  return targetConfig;
}

function getStartTargetConfig(options: NextPluginOptions, projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `next start`,
    options: {
      cwd: projectRoot,
    },
    dependsOn: [options.buildTargetName],
  };

  return targetConfig;
}

function getStaticServeTargetConfig(options: NextPluginOptions) {
  const targetConfig: TargetConfiguration = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: options.buildTargetName,
      staticFilePath: '{projectRoot}/out',
      port: 3000,
      // Routes are found correctly with serve-static
      spa: false,
    },
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

function normalizeOptions(options: NextPluginOptions): NextPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.devTargetName ??= 'dev';
  options.startTargetName ??= 'start';
  options.serveStaticTargetName ??= 'serve-static';
  return options;
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
