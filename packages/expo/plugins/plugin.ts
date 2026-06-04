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
  getPackageManagerCommand,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { basename, dirname, join } from 'path';
import { getLockFileName } from '@nx/js';
import { readdirSync } from 'fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/devkit-internals';
import { addBuildAndWatchDepsTargets } from '@nx/js/internal';

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

type ExpoTargets = Record<string, TargetConfiguration<ExpoPluginOptions>>;

// Keyed per (project hash, config file) so warm runs can reuse the filter
// decision without executing the app config. `included` is only stored when
// the decision derives from inputs covered by the cache key (app.json
// content, sibling-file existence, or an expo dependency in the project's
// package.json); decisions resting on executed JS/TS config content are
// re-evaluated every run. `targets` is set lazily for included entries.
interface ExpoCacheEntry {
  included?: boolean;
  targets?: ExpoTargets;
}

export const createNodes: CreateNodes<ExpoPluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `expo-${optionsHash}.hash`);
    const cache = new PluginCache<ExpoCacheEntry>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);
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

      const { entries, preErrors } = await filterExpoConfigs(
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
              pmc,
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
  options: ExpoPluginOptions,
  context: CreateNodesContext,
  cache: PluginCache<ExpoCacheEntry>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  cacheKey: string
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFile);

  const entry = cache.get(cacheKey) ?? {};
  if (!entry.targets) {
    entry.targets = buildExpoTargets(projectRoot, options, context, pmc);
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

function buildExpoTargets(
  projectRoot: string,
  options: ExpoPluginOptions,
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>
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

async function filterExpoConfigs(
  configFiles: readonly string[],
  cacheKeys: readonly string[],
  cache: PluginCache<ExpoCacheEntry>,
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
          const packageJson = readJsonFile(
            join(context.workspaceRoot, projectRoot, 'package.json')
          );
          const pkgHasExpo = !!(
            packageJson.dependencies?.['expo'] ||
            packageJson.devDependencies?.['expo']
          );
          const appConfig = await getAppConfig(configFile, context);
          const included = !!appConfig.expo || pkgHasExpo;
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

function normalizeOptions(options: ExpoPluginOptions): ExpoPluginOptions {
  // Do not mutate the input: the daemon passes the same options object on
  // every invocation, and mutating it changes the option-derived hashes
  // between the first and subsequent runs.
  return {
    ...options,
    startTargetName: options?.startTargetName ?? 'start',
    serveTargetName: options?.serveTargetName ?? 'serve',
    runIosTargetName: options?.runIosTargetName ?? 'run-ios',
    runAndroidTargetName: options?.runAndroidTargetName ?? 'run-android',
    exportTargetName: options?.exportTargetName ?? 'export',
    prebuildTargetName: options?.prebuildTargetName ?? 'prebuild',
    installTargetName: options?.installTargetName ?? 'install',
    buildTargetName: options?.buildTargetName ?? 'build',
    submitTargetName: options?.submitTargetName ?? 'submit',
  };
}
