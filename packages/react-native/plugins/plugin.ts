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
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';

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

const cachePath = join(projectGraphCacheDirectory, 'react-native.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration<ReactNativePluginOptions>>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<
    string,
    Record<string, TargetConfiguration<ReactNativePluginOptions>>
  >
) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<ReactNativePluginOptions> = [
  '**/app.{json,config.js}',
  (configFilePath, options, context) => {
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
    const appConfig = getAppConfig(configFilePath, context);
    if (appConfig.expo) {
      return {};
    }

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);

    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : buildReactNativeTargets(projectRoot, options, context);

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
      cache: true,
      inputs: getInputs(namedInputs),
      outputs: [
        getOutputs(projectRoot, 'ios/Pods'),
        getOutputs(projectRoot, 'ios/Podfile.lock'),
      ],
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
): any {
  const resolvedPath = join(context.workspaceRoot, configFilePath);

  let module = load(resolvedPath);
  return module.default ?? module;
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

/**
 * Load the module after ensuring that the require cache is cleared.
 */
function load(path: string): any {
  // Clear cache if the path is in the cache
  if (require.cache[path]) {
    for (const k of Object.keys(require.cache)) {
      delete require.cache[k];
    }
  }

  // Then require
  return require(path);
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
