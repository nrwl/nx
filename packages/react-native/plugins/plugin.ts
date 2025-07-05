import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  joinPathFragments,
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
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { hashObject } from 'nx/src/devkit-internals';

export interface ReactNativePluginOptions {
  startTargetName?: string;
  podInstallTargetName?: string;
  runIosTargetName?: string;
  runAndroidTargetName?: string;
  buildIosTargetName?: string;
  buildAndroidTargetName?: string;
  bundleTargetName?: string;
  syncDepsTargetName?: string;
  upgradeTargetName?: string;
}

const defaultOptions: Required<ReactNativePluginOptions> = {
  startTargetName: 'start',
  podInstallTargetName: 'pod-install',
  runIosTargetName: 'run-ios',
  runAndroidTargetName: 'run-android',
  buildIosTargetName: 'build-ios',
  buildAndroidTargetName: 'build-android',
  bundleTargetName: 'bundle',
  syncDepsTargetName: 'sync-deps',
  upgradeTargetName: 'upgrade',
};

function readTargetsCache(
  cachePath: string
): Record<
  string,
  Record<string, TargetConfiguration<ReactNativePluginOptions>>
> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  targetsCache: Record<
    string,
    Record<string, TargetConfiguration<ReactNativePluginOptions>>
  >
) {
  const oldCache = readTargetsCache(cachePath);
  writeJsonFile(cachePath, {
    ...oldCache,
    targetsCache,
  });
}

export const createNodesV2: CreateNodesV2<ReactNativePluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFiles, options, context) => {
    const normalizedOptions = normalizeOptions(options, defaultOptions);
    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(
      workspaceDataDirectory,
      `react-native-${optionsHash}.hash`
    );
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

export const createNodes: CreateNodes<ReactNativePluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFilePath, options, context) => {
    const normalizedOptions = normalizeOptions(options, defaultOptions);
    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(
      workspaceDataDirectory,
      `react-native-${optionsHash}.hash`
    );

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
  configFile: string,
  options: ReactNativePluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<
    string,
    Record<string, TargetConfiguration<ReactNativePluginOptions>>
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
    appConfig.expo ||
    packageJson.dependencies?.['expo'] ||
    packageJson.devDependencies?.['expo']
  ) {
    return {};
  }

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= buildReactNativeTargets(projectRoot, options, context);

  return {
    projects: {
      [projectRoot]: {
        targets: targetsCache[hash],
      },
    },
  };
}

function buildReactNativeTargets(
  projectRoot: string,
  options: ReactNativePluginOptions,
  context: CreateNodesContext
) {
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {
    [options.startTargetName]: {
      command: `react-native start`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.podInstallTargetName]: {
      command: `pod install`,
      options: { cwd: joinPathFragments(projectRoot, 'ios') },
      dependsOn: [`${options.syncDepsTargetName}`],
    },
    [options.runIosTargetName]: {
      command: `react-native run-ios`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.runAndroidTargetName]: {
      command: `react-native run-android`,
      continuous: true,
      options: { cwd: projectRoot },
    },
    [options.buildIosTargetName]: {
      command: `react-native build-ios`,
      options: { cwd: projectRoot },
      cache: true,
      dependsOn: [`^${options.buildIosTargetName}`],
      inputs: getInputs(namedInputs),
      outputs: [getOutputs(projectRoot, 'ios/build/Build/Products')],
    },
    [options.buildAndroidTargetName]: {
      command: `react-native build-android`,
      options: { cwd: projectRoot },
      cache: true,
      dependsOn: [`^${options.buildAndroidTargetName}`],
      inputs: getInputs(namedInputs),
      outputs: [getOutputs(projectRoot, 'android/app/build/outputs')],
    },
    [options.bundleTargetName]: {
      command: `react-native bundle`,
      options: { cwd: projectRoot },
      dependsOn: [`^${options.bundleTargetName}`],
      inputs: getInputs(namedInputs),
    },
    [options.syncDepsTargetName]: {
      executor: '@nx/react-native:sync-deps',
    },
    [options.upgradeTargetName]: {
      command: `react-native upgrade`,
      options: { cwd: projectRoot },
    },
  };

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
      externalDependencies: ['react-native'],
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
