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
import { basename, dirname, join } from 'path';
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

// Keyed per (project hash, config file) so warm runs can reuse the filter
// decision without executing the app config. `included` is only stored when
// the decision derives from inputs covered by the cache key (app.json
// content, sibling-file existence, or an expo dependency in the project's
// package.json); decisions resting on executed JS/TS config content are
// re-evaluated every run. `targets` is set lazily for included entries.
interface ReactNativeCacheEntry {
  included?: boolean;
  targets?: ReactNativeTargets;
}

export const createNodes: CreateNodes<ReactNativePluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `react-native-${optionsHash}.hash`
    );
    const cache = new PluginCache<ReactNativeCacheEntry>(cachePath);
    const lockFileName = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
    const normalizedOptions = normalizeOptions(options);

    try {
      // Per-candidate keys computable without executing configs. Keyed per
      // config file because two config files in the same root (app.json +
      // app.config.js) can produce different filter outcomes.
      const projectHashes = await calculateHashesForCreateNodes(
        configFiles.map((configFile) => dirname(configFile)),
        normalizedOptions,
        context,
        configFiles.map(() => [lockFileName])
      );
      const cacheKeys = configFiles.map(
        (configFile, idx) => `${projectHashes[idx]}|${configFile}`
      );

      const { entries, preErrors } = await filterReactNativeConfigs(
        configFiles,
        cacheKeys,
        cache,
        context
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
              cache,
              entries[idx].cacheKey
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
      cache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFile: string,
  options: ReactNativePluginOptions,
  context: CreateNodesContext,
  cache: PluginCache<ReactNativeCacheEntry>,
  cacheKey: string
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFile);

  const entry = cache.get(cacheKey) ?? {};
  if (!entry.targets) {
    entry.targets = buildReactNativeTargets(projectRoot, options, context);
    cache.set(cacheKey, entry);
  }

  return {
    projects: {
      [projectRoot]: {
        targets: entry.targets,
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
  cacheKeys: readonly string[],
  cache: PluginCache<ReactNativeCacheEntry>,
  context: CreateNodesContext
): Promise<{
  entries: Array<{ configFile: string; cacheKey: string }>;
  preErrors: Array<[string, Error]>;
}> {
  const preErrors: Array<[string, Error]> = [];
  const candidates = await Promise.all(
    configFiles.map(
      async (
        configFile,
        idx
      ): Promise<{ configFile: string; cacheKey: string } | null> => {
        const cacheKey = cacheKeys[idx];
        const cached = cache.get(cacheKey);
        if (cached?.included !== undefined) {
          return cached.included ? { configFile, cacheKey } : null;
        }
        try {
          const projectRoot = dirname(configFile);
          const siblingFiles = readdirSync(
            join(context.workspaceRoot, projectRoot)
          );
          if (
            !siblingFiles.includes('package.json') ||
            !siblingFiles.includes('metro.config.js')
          ) {
            cache.set(cacheKey, { ...cached, included: false });
            return null;
          }
          // Skip Expo projects; the @nx/expo plugin handles them.
          const packageJson = readJsonFile(
            join(context.workspaceRoot, projectRoot, 'package.json')
          );
          const pkgHasExpo = !!(
            packageJson.dependencies?.['expo'] ||
            packageJson.devDependencies?.['expo']
          );
          const appConfig = await getAppConfig(configFile, context);
          const included = !appConfig.expo && !pkgHasExpo;
          // A decision resting on executed JS/TS config content can depend on
          // inputs outside the cache key (imports, fs reads, env vars), so it
          // is only cached when package.json pins it or the config is data.
          if (pkgHasExpo || basename(configFile) === 'app.json') {
            cache.set(cacheKey, { ...cached, included });
          }
          return included ? { configFile, cacheKey } : null;
        } catch (e) {
          // Not cached: load errors must resurface on every run.
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
  // Do not mutate the input: the daemon passes the same options object on
  // every invocation, and mutating it changes the option-derived hashes
  // between the first and subsequent runs.
  return {
    ...options,
    startTargetName: options?.startTargetName ?? 'start',
    podInstallTargetName: options?.podInstallTargetName ?? 'pod-install',
    runIosTargetName: options?.runIosTargetName ?? 'run-ios',
    runAndroidTargetName: options?.runAndroidTargetName ?? 'run-android',
    buildIosTargetName: options?.buildIosTargetName ?? 'build-ios',
    buildAndroidTargetName: options?.buildAndroidTargetName ?? 'build-android',
    bundleTargetName: options?.bundleTargetName ?? 'bundle',
    syncDepsTargetName: options?.syncDepsTargetName ?? 'sync-deps',
    upgradeTargetName: options?.upgradeTargetName ?? 'upgrade',
  };
}
