import {
  getNamedInputs,
  getReadyCheckReadyWhen,
  calculateHashesForCreateNodes,
  PluginCache,
  hashObject,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  CreateNodesResultArray,
  type ProjectConfiguration,
  type TargetConfiguration,
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  joinPathFragments,
  getPackageManagerCommand,
  detectPackageManager,
  normalizePath,
} from '@nx/devkit';
import { addBuildAndWatchDepsTargets } from '@nx/js/internal';
import { getLockFileName } from '@nx/js';
import { readdirSync } from 'fs';
import { basename, dirname, isAbsolute, join, relative } from 'path';
import type { RsbuildConfig } from '@rsbuild/core';
export interface RsbuildPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  previewTargetName?: string;
  inspectTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type RsbuildTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

const rsbuildConfigGlob = '**/rsbuild.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodes: CreateNodes<RsbuildPluginOptions> = [
  rsbuildConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `rsbuild-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<RsbuildTargets>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);
    const normalizedOptions = normalizeOptions(options);

    try {
      const { entries, preErrors } = await filterRsbuildConfigs(
        configFilePaths,
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

/**
 * @deprecated Use {@link createNodes} instead. This will be removed in Nx 24.
 */
export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFilePath: string,
  normalizedOptions: RsbuildPluginOptions,
  context: CreateNodesContext,
  targetsCache: PluginCache<RsbuildTargets>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  hash: string
) {
  const projectRoot = dirname(configFilePath);

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      await createRsbuildTargets(
        configFilePath,
        projectRoot,
        normalizedOptions,
        context,
        pmc
      )
    );
  }

  const { targets, metadata } = targetsCache.get(hash);

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets,
        metadata,
      },
    },
  };
}

async function createRsbuildTargets(
  configFilePath: string,
  projectRoot: string,
  options: RsbuildPluginOptions,
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>
): Promise<RsbuildTargets> {
  const absoluteConfigFilePath = joinPathFragments(
    context.workspaceRoot,
    configFilePath
  );

  // Required lazily: `@rsbuild/core` is an optional peer dependency, so it
  // may be absent when the plugin is loaded in a workspace that doesn't use
  // Rsbuild yet (e.g. before a generator installs it). This path runs in
  // the CLI/daemon (never Jest), so a plain require works on Node 22.12+
  // via require(esm) for the pure-ESM @rsbuild/core@2.
  const { loadConfig } =
    require('@rsbuild/core') as typeof import('@rsbuild/core');
  const rsbuildConfig = await loadConfig({
    path: absoluteConfigFilePath,
  });
  if (!rsbuildConfig.filePath) {
    return { targets: {}, metadata: {} };
  }

  const namedInputs = getNamedInputs(projectRoot, context);
  const { buildOutputs } = getOutputs(
    rsbuildConfig.content,
    projectRoot,
    context.workspaceRoot
  );

  const targets: Record<string, TargetConfiguration> = {};

  const buildInputs: TargetConfiguration['inputs'] = [
    ...('production' in namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['@rsbuild/core'],
    },
  ];

  targets[options.buildTargetName] = {
    command: `rsbuild build`,
    options: { cwd: projectRoot, args: ['--mode=production'] },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs: [...buildInputs],
    outputs: buildOutputs,
    metadata: {
      technologies: ['rsbuild'],
      description: `Run Rsbuild build`,
      help: {
        command: `${pmc.exec} rsbuild build --help`,
        example: {
          options: {
            watch: false,
          },
        },
      },
    },
  };

  const signals = await loadsReadySignalPlugin(rsbuildConfig.content.plugins);

  targets[options.devTargetName] = {
    continuous: true,
    inputs: [...buildInputs],
    command: `rsbuild dev`,
    options: {
      cwd: projectRoot,
      args: ['--mode=development'],
    },
    readyWhen: getServerReadyWhen(configFilePath, 'dev', signals),
  };

  targets[options.previewTargetName] = {
    continuous: true,
    inputs: [...buildInputs],
    command: `rsbuild preview`,
    dependsOn: [`${options.buildTargetName}`, `^${options.buildTargetName}`],
    options: {
      cwd: projectRoot,
      args: ['--mode=production'],
    },
    readyWhen: getServerReadyWhen(configFilePath, 'preview', signals),
  };

  targets[options.inspectTargetName] = {
    command: `rsbuild inspect`,
    options: {
      cwd: projectRoot,
    },
  };

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return { targets, metadata: {} };
}

function getOutputs(
  rsbuildConfig: RsbuildConfig,
  projectRoot: string,
  workspaceRoot: string
): { buildOutputs: string[] } {
  // `output.distPath.root` is the directory Rsbuild emits the build into, so
  // it is the build output as-is. (Don't take its `dirname` - that points at
  // the parent directory, which can capture sibling projects' outputs.)
  // Rsbuild 2 also accepts `distPath` as a string, shorthand for `distPath.root`.
  const distPath = rsbuildConfig?.output?.distPath;
  const buildOutputPath = normalizeOutputPath(
    typeof distPath === 'string' ? distPath : distPath?.root,
    projectRoot,
    workspaceRoot,
    'dist'
  );

  return {
    buildOutputs: [buildOutputPath],
  };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string,
  workspaceRoot: string,
  path: 'dist'
): string | undefined {
  if (!outputPath) {
    if (projectRoot === '.') {
      return `{projectRoot}/${path}`;
    } else {
      return `{workspaceRoot}/${path}/{projectRoot}`;
    }
  } else {
    if (isAbsolute(outputPath)) {
      return `{workspaceRoot}/${normalizePath(relative(workspaceRoot, outputPath))}`;
    } else {
      if (outputPath.startsWith('..')) {
        return joinPathFragments('{workspaceRoot}', projectRoot, outputPath);
      } else {
        return joinPathFragments('{projectRoot}', outputPath);
      }
    }
  }
}

interface RsbuildEntry {
  configFile: string;
  projectRoot: string;
}

async function filterRsbuildConfigs(
  configFiles: readonly string[],
  context: CreateNodesContext
): Promise<{
  entries: RsbuildEntry[];
  preErrors: Array<[string, Error]>;
}> {
  const preErrors: Array<[string, Error]> = [];
  const candidates = await Promise.all(
    configFiles.map(async (configFile): Promise<RsbuildEntry | null> => {
      try {
        const projectRoot = dirname(configFile);
        const siblingFiles = readdirSync(
          join(context.workspaceRoot, projectRoot)
        );
        if (
          !siblingFiles.includes('package.json') &&
          !siblingFiles.includes('project.json')
        ) {
          return null;
        }
        return { configFile, projectRoot };
      } catch (e) {
        preErrors.push([configFile, e as Error]);
        return null;
      }
    })
  );
  return {
    entries: candidates.filter((c): c is RsbuildEntry => c !== null),
    preErrors,
  };
}

function normalizeOptions(options: RsbuildPluginOptions): RsbuildPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.devTargetName ??= 'dev';
  options.previewTargetName ??= 'preview';
  options.inspectTargetName ??= 'inspect';
  return options;
}

// A config that loads pluginNxReadySignal() reports when the server listens.
// Otherwise the check loads the config when the task runs, with the task's
// env and options, and waits for the server's port.
function getServerReadyWhen(
  configFilePath: string,
  command: 'dev' | 'preview',
  signals: boolean
): TargetConfiguration['readyWhen'] {
  return signals
    ? { signal: true }
    : getReadyCheckReadyWhen(
        '@nx/rsbuild/ready-check',
        basename(configFilePath),
        command
      );
}

// Rsbuild's plugins option nests arrays and promises, and allows falsy entries
async function loadsReadySignalPlugin(plugins: unknown): Promise<boolean> {
  const plugin = await plugins;
  if (Array.isArray(plugin)) {
    for (const entry of plugin) {
      if (await loadsReadySignalPlugin(entry)) return true;
    }
    return false;
  }
  return (plugin as { name?: unknown } | null)?.name === 'nx:ready-signal';
}
