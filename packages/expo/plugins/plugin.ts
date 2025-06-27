import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  logger,
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
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { normalizeOptions } from 'nx/src/utils/normalize-options';
import { hashObject } from 'nx/src/devkit-internals';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

export interface ExpoPluginOptions {
  startTargetName?: string;
  serveTargetName?: string;
  runIosTargetName?: string;
  runAndroidTargetName?: string;
  exportTargetName?: string;
  prebuildTargetName?: string;
  installTargetName?: string;
  buildTargetName?: string;
  submitTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

const defaultOptions: ExpoPluginOptions = {
  startTargetName: 'start',
  serveTargetName: 'serve',
  runIosTargetName: 'run-ios',
  runAndroidTargetName: 'run-android',
  exportTargetName: 'export',
  prebuildTargetName: 'prebuild',
  installTargetName: 'install',
  buildTargetName: 'build',
  submitTargetName: 'submit',
};

const pmc = getPackageManagerCommand();

function readTargetsCache(
  cachePath: string
): Record<string, Record<string, TargetConfiguration<ExpoPluginOptions>>> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  targetsCache: Record<
    string,
    Record<string, TargetConfiguration<ExpoPluginOptions>>
  >
) {
  const oldCache = readTargetsCache(cachePath);
  writeJsonFile(cachePath, {
    ...oldCache,
    targetsCache,
  });
}

export const createNodesV2: CreateNodesV2<ExpoPluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFiles, options, context) => {
    const normalizedOptions = normalizeOptions(options, defaultOptions);

    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(workspaceDataDirectory, `expo-${optionsHash}.hash`);
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

export const createNodes: CreateNodes<ExpoPluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    const normalizedOptions = normalizeOptions(options, defaultOptions);

    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(workspaceDataDirectory, `expo-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);

    return createNodesInternal(
      configFilePath,
      normalizedOptions,
      context,
      targetsCache
    );
  },
];

async function createNodesInternal(
  configFile: string,
  options: ExpoPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<
    string,
    Record<string, TargetConfiguration<ExpoPluginOptions>>
  >
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFile);

  // Do not create a project if package.json or project.json or metro.config.js isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') ||
    !siblingFiles.includes('metro.config.js')
  ) {
    return {};
  }

  // Check if it's an Expo project
  const packageJson = readJsonFile(
    join(context.workspaceRoot, projectRoot, 'package.json')
  );
  const appConfig = await getAppConfig(configFile, context);
  if (
    !appConfig.expo &&
    !packageJson.dependencies?.['expo'] &&
    !packageJson.devDependencies?.['expo']
  ) {
    return {};
  }

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= buildExpoTargets(projectRoot, options, context);

  return {
    projects: {
      [projectRoot]: {
        targets: targetsCache[hash],
      },
    },
  };
}

function buildExpoTargets(
  projectRoot: string,
  options: ExpoPluginOptions,
  context: CreateNodesContext
) {
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {
    [options.startTargetName]: {
      executor: `@nx/expo:start`,
      continuous: true,
    },
    [options.serveTargetName]: {
      command: `expo start --web`,
      continuous: true,
      options: { cwd: projectRoot, args: ['--clear'] },
    },
    [options.runIosTargetName]: {
      command: `expo run:ios`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.runAndroidTargetName]: {
      command: `expo run:android`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.exportTargetName]: {
      command: `expo export`,
      options: { cwd: projectRoot, args: ['--clear'] },
      cache: true,
      dependsOn: [`^${options.exportTargetName}`],
      inputs: getInputs(namedInputs),
      outputs: [getOutputs(projectRoot, 'dist')],
    },
    [options.installTargetName]: {
      executor: '@nx/expo:install',
    },
    [options.prebuildTargetName]: {
      executor: `@nx/expo:prebuild`,
    },
    [options.buildTargetName]: {
      executor: `@nx/expo:build`,
    },
    [options.submitTargetName]: {
      command: `eas submit`,
      options: { cwd: projectRoot },
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

function getAppConfig(
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
      externalDependencies: ['expo'],
    },
  ];
}

function getOutputs(projectRoot: string, dir: string) {
  if (projectRoot === '.') {
    return `{projectRoot}/${dir}`;
  } else {
    return `{workspaceRoot}/${projectRoot}/${dir}`;
  }
}
