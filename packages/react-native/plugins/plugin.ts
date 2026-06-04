import {
  getNamedInputs,
  calculateHashesForCreateNodes,
  loadConfigFile,
  PluginCache,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesResultV2,
  CreateNodes,
  detectPackageManager,
  joinPathFragments,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
import { readdirSync } from 'fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
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

type ReactNativeTargets = Record<
  string,
  TargetConfiguration<ReactNativePluginOptions>
>;

export const createNodes: CreateNodes<ReactNativePluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `react-native-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<ReactNativeTargets>(cachePath);
    const lockFileName = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
    const normalizedOptions = normalizeOptions(options);

    try {
      const { entries, preErrors } = await filterReactNativeConfigs(
        configFiles,
        context
      );

      const projectHashes = await calculateHashesForCreateNodes(
        entries.map((e) => e.projectRoot),
        normalizedOptions,
        context,
        entries.map(() => [lockFileName])
      );

      let results: CreateNodesResultV2 = [];
      let nodeErrors: Array<[string | null, Error]> = [];
      try {
        results = await createNodesFromFiles(
          (configFile, _, ctx, idx) =>
            createNodesInternal(
              configFile,
              normalizedOptions,
              ctx,
              targetsCache,
              projectHashes[idx]
            ),
          entries.map((e) => e.configFile),
          options,
          context
        );
      } catch (e) {
        if (e instanceof AggregateCreateNodesError) {
          results = e.partialResults ?? [];
          nodeErrors = e.errors;
        } else {
          throw e;
        }
      }

      const allErrors = [...preErrors, ...nodeErrors];
      if (allErrors.length > 0) {
        throw new AggregateCreateNodesError(allErrors, results);
      }
      return results;
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFile: string,
  options: ReactNativePluginOptions,
  context: CreateNodesContext,
  targetsCache: PluginCache<ReactNativeTargets>,
  hash: string
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFile);

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      buildReactNativeTargets(projectRoot, options, context)
    );
  }

  return {
    projects: {
      [projectRoot]: {
        targets: targetsCache.get(hash),
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

async function filterReactNativeConfigs(
  configFiles: readonly string[],
  context: CreateNodesContext
): Promise<{
  entries: Array<{ configFile: string; projectRoot: string }>;
  preErrors: Array<[string, Error]>;
}> {
  const preErrors: Array<[string, Error]> = [];
  const candidates = await Promise.all(
    configFiles.map(
      async (
        configFile
      ): Promise<{ configFile: string; projectRoot: string } | null> => {
        try {
          const projectRoot = dirname(configFile);
          const siblingFiles = readdirSync(
            join(context.workspaceRoot, projectRoot)
          );
          if (
            !siblingFiles.includes('package.json') ||
            !siblingFiles.includes('metro.config.js')
          ) {
            return null;
          }
          // Skip Expo projects; the @nx/expo plugin handles them.
          const packageJson = readJsonFile(
            join(context.workspaceRoot, projectRoot, 'package.json')
          );
          const appConfig = await getAppConfig(configFile, context);
          if (
            appConfig.expo ||
            packageJson.dependencies?.['expo'] ||
            packageJson.devDependencies?.['expo']
          ) {
            return null;
          }
          return { configFile, projectRoot };
        } catch (e) {
          preErrors.push([configFile, e as Error]);
          return null;
        }
      }
    )
  );
  return {
    entries: candidates.filter((c): c is NonNullable<typeof c> => c !== null),
    preErrors,
  };
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
  options.upgradeTargetName ??= 'upgrade';
  return options;
}
