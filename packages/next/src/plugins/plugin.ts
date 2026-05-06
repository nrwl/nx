import {
  calculateHashForCreateNodes,
  loadConfigFile,
  getNamedInputs,
  PluginCache,
} from '@nx/devkit/internal';
import {
  CreateDependencies,
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  NxJsonConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { getLockFileName } from '@nx/js';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { readdirSync } from 'fs';
import { hashObject } from 'nx/src/devkit-internals';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { dirname, join } from 'path';

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

const nextConfigBlob = '**/next.config.{ts,js,cjs,mjs}';

type NextTargets = Record<string, TargetConfiguration<NextPluginOptions>>;

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

export const createNodes: CreateNodesV2<NextPluginOptions> = [
  nextConfigBlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `next-${optionsHash}.json`);
    const targetsCache = new PluginCache<NextTargets>(cachePath);
    const isTsSolutionSetup = isUsingTsSolutionSetup();
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
            isTsSolutionSetup,
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
  configFilePath: string,
  options: NextPluginOptions,
  context: CreateNodesContextV2,
  targetsCache: PluginCache<NextTargets>,
  isTsSolutionSetup: boolean,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  lockFileName: string
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
  options = normalizeOptions(options);

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [lockFileName]
  );

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      await buildNextTargets(
        configFilePath,
        projectRoot,
        options,
        context,
        isTsSolutionSetup,
        pmc
      )
    );
  }

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets: targetsCache.get(hash),
      },
    },
  };
}

async function buildNextTargets(
  nextConfigPath: string,
  projectRoot: string,
  options: NextPluginOptions,
  context: CreateNodesContextV2,
  isTsSolutionSetup: boolean,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const nextConfig = await getNextConfig(nextConfigPath, context);
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = await getBuildTargetConfig(
    namedInputs,
    projectRoot,
    nextConfig,
    isTsSolutionSetup
  );

  targets[options.devTargetName] = getDevTargetConfig(
    projectRoot,
    isTsSolutionSetup
  );

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
  nextConfig: any,
  isTsSolutionSetup: boolean
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

  if (isTsSolutionSetup) {
    targetConfig.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return targetConfig;
}

function getDevTargetConfig(projectRoot: string, isTsSolutionSetup: boolean) {
  const targetConfig: TargetConfiguration = {
    continuous: true,
    command: `next dev`,
    options: {
      cwd: projectRoot,
    },
  };

  if (isTsSolutionSetup) {
    targetConfig.syncGenerators = ['@nx/js:typescript-sync'];
  }

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
  context: CreateNodesContextV2
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
      ? ['default', '^default']
      : ['default', '^default']),
    {
      externalDependencies: ['next'],
    },
    {
      dependentTasksOutputFiles: '**/*.d.ts',
      transitive: true,
    },
  ];
}
