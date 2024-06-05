import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
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
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface ReactNativePluginOptions {
  startTargetName?: string;
  podInstallTargetName?: string;
  runIosTargetName?: string;
  runAndroidTargetName?: string;
  buildIosTargetName?: string;
  buildAndroidTargetName?: string;
  bundleTargetName?: string;
  syncDepsTargetName?: string;
  upgradeTargetname?: string;
}

const cachePath = join(workspaceDataDirectory, 'react-native.hash');
const targetsCache = readTargetsCache();
function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration<ReactNativePluginOptions>>
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

export const createNodes: CreateNodes<ReactNativePluginOptions> = [
  '**/app.{json,config.js}',
  async (configFilePath, options, context) => {
    options = normalizeOptions(options);
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json or project.json or metro.config.js isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') ||
      !siblingFiles.includes('metro.config.js')
    ) {
      return {};
    }
    const appConfig = await getAppConfig(configFilePath, context);
    if (appConfig.expo) {
      return {};
    }

    const hash = await calculateHashForCreateNodes(
      projectRoot,
      options,
      context,
      [getLockFileName(detectPackageManager(context.workspaceRoot))]
    );

    targetsCache[hash] ??= buildReactNativeTargets(
      projectRoot,
      options,
      context
    );

    return {
      projects: {
        [projectRoot]: {
          targets: targetsCache[hash],
        },
      },
    };
  },
];

function buildReactNativeTargets(
  projectRoot: string,
  options: ReactNativePluginOptions,
  context: CreateNodesContext
) {
  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {
    [options.startTargetName]: {
      command: `react-native start`,
      options: { cwd: projectRoot },
    },
    [options.podInstallTargetName]: {
      command: `pod install`,
      options: { cwd: joinPathFragments(projectRoot, 'ios') },
      dependsOn: [`${options.syncDepsTargetName}`],
    },
    [options.runIosTargetName]: {
      command: `react-native run-ios`,
      options: { cwd: projectRoot },
    },
    [options.runAndroidTargetName]: {
      command: `react-native run-android`,
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
    [options.upgradeTargetname]: {
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

function normalizeOptions(
  options: ReactNativePluginOptions
): ReactNativePluginOptions {
  options ??= {};
  options.startTargetName ??= 'start';
  options.podInstallTargetName ??= 'pod-install';
  options.runIosTargetName ??= 'run-ios';
  options.runAndroidTargetName ??= 'run-android';
  options.buildIosTargetName ??= 'build-ios';
  options.buildAndroidTargetName ??= 'build-android';
  options.bundleTargetName ??= 'bundle';
  options.syncDepsTargetName ??= 'sync-deps';
  options.upgradeTargetname ??= 'upgrade';
  return options;
}
