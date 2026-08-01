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
  CreateNodesResultArray,
  CreateNodes,
  detectPackageManager,
  getPackageManagerCommand,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join } from 'path';
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

export const createNodes: CreateNodes<ExpoPluginOptions> = [
  '**/app.{json,config.js,config.ts}',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `expo-${optionsHash}.hash`);
    const targetsCache = new PluginCache<ExpoTargets>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);
    const normalizedOptions = normalizeOptions(options);

    try {
      const { entries, preErrors } = await filterExpoConfigs(
        configFiles,
        context
      );

      const projectHashes = await calculateHashesForCreateNodes(
        entries.map((e) => e.projectRoot),
        normalizedOptions,
        context,
        entries.map(() => [lockFileName])
      );

      let results: CreateNodesResultArray = [];
      let nodeErrors: Array<[string | null, Error]> = [];
      try {
        results = await createNodesFromFiles(
          (configFile, _, ctx, idx) =>
            createNodesInternal(
              configFile,
              normalizedOptions,
              ctx,
              targetsCache,
              pmc,
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
  options: ExpoPluginOptions,
  context: CreateNodesContext,
  targetsCache: PluginCache<ExpoTargets>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  hash: string
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFile);

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      buildExpoTargets(projectRoot, options, context, pmc)
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
      continuous: false,
    },
    [options.prebuildTargetName]: {
      executor: `@nx/expo:prebuild`,
      continuous: false,
    },
    [options.buildTargetName]: {
      executor: `@nx/expo:build`,
      continuous: false,
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
          const packageJson = readJsonFile(
            join(context.workspaceRoot, projectRoot, 'package.json')
          );
          const appConfig = await getAppConfig(configFile, context);
          if (
            !appConfig.expo &&
            !packageJson.dependencies?.['expo'] &&
            !packageJson.devDependencies?.['expo']
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
  options ??= {};
  options.startTargetName ??= 'start';
  options.serveTargetName ??= 'serve';
  options.runIosTargetName ??= 'run-ios';
  options.runAndroidTargetName ??= 'run-android';
  options.exportTargetName ??= 'export';
  options.prebuildTargetName ??= 'prebuild';
  options.installTargetName ??= 'install';
  options.buildTargetName ??= 'build';
  options.submitTargetName ??= 'submit';
  return options;
}
