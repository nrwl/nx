import {
  getNamedInputs,
  calculateHashesForCreateNodes,
  PluginCache,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  CreateNodesResultV2,
  type ProjectConfiguration,
  type TargetConfiguration,
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  joinPathFragments,
  getPackageManagerCommand,
  detectPackageManager,
} from '@nx/devkit';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import {
  isUsingTsSolutionSetup as _isUsingTsSolutionSetup,
  addBuildAndWatchDepsTargets,
} from '@nx/js/internal';
import { getLockFileName } from '@nx/js';
import { readdirSync } from 'fs';
import { join, dirname, isAbsolute, relative } from 'path';
import { minimatch } from 'minimatch';
import type { RsbuildConfig } from '@rsbuild/core';
export interface RsbuildPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  previewTargetName?: string;
  inspectTargetName?: string;
  typecheckTargetName?: string;
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
    const isUsingTsSolutionSetup = _isUsingTsSolutionSetup();
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
        { ...normalizedOptions, isUsingTsSolutionSetup },
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
              isUsingTsSolutionSetup,
              pmc,
              entries[idx].tsConfigFiles,
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
  isUsingTsSolutionSetup: boolean,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  tsConfigFiles: string[],
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
        tsConfigFiles,
        isUsingTsSolutionSetup,
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
  tsConfigFiles: string[],
  isUsingTsSolutionSetup: boolean,
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>
): Promise<RsbuildTargets> {
  const absoluteConfigFilePath = joinPathFragments(
    context.workspaceRoot,
    configFilePath
  );

  // Required lazily: `@rsbuild/core` is an optional peer dependency, so it
  // may be absent when the plugin is loaded in a workspace that doesn't use
  // Rsbuild yet (e.g. before a generator installs it).
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

  targets[options.buildTargetName] = {
    command: `rsbuild build`,
    options: { cwd: projectRoot, args: ['--mode=production'] },
    cache: true,
    dependsOn: [`^${options.buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      {
        externalDependencies: ['@rsbuild/core'],
      },
    ],
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

  targets[options.devTargetName] = {
    continuous: true,
    command: `rsbuild dev`,
    options: {
      cwd: projectRoot,
      args: ['--mode=development'],
    },
  };

  targets[options.previewTargetName] = {
    continuous: true,
    command: `rsbuild preview`,
    dependsOn: [`${options.buildTargetName}`, `^${options.buildTargetName}`],
    options: {
      cwd: projectRoot,
      args: ['--mode=production'],
    },
  };

  targets[options.inspectTargetName] = {
    command: `rsbuild inspect`,
    options: {
      cwd: projectRoot,
    },
  };

  if (tsConfigFiles.length) {
    const tsConfigToUse =
      ['tsconfig.app.json', 'tsconfig.lib.json', 'tsconfig.json'].find((t) =>
        tsConfigFiles.includes(t)
      ) ?? tsConfigFiles[0];
    targets[options.typecheckTargetName] = {
      cache: true,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        { externalDependencies: ['typescript'] },
      ],
      command: isUsingTsSolutionSetup
        ? `tsc --build --emitDeclarationOnly`
        : `tsc -p ${tsConfigToUse} --noEmit`,
      options: { cwd: joinPathFragments(projectRoot) },
      metadata: {
        description: `Runs type-checking for the project.`,
        technologies: ['typescript'],
        help: {
          command: isUsingTsSolutionSetup
            ? `${pmc.exec} tsc --build --help`
            : `${pmc.exec} tsc -p ${tsConfigToUse} --help`,
          example: isUsingTsSolutionSetup
            ? { args: ['--force'] }
            : { options: { noEmit: true } },
        },
      },
    };

    if (isUsingTsSolutionSetup) {
      targets[options.typecheckTargetName].dependsOn = [
        `^${options.typecheckTargetName}`,
      ];
      targets[options.typecheckTargetName].syncGenerators = [
        '@nx/js:typescript-sync',
      ];
    }
  }

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
  const buildOutputPath = normalizeOutputPath(
    rsbuildConfig?.output?.distPath?.root,
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
      return `{workspaceRoot}/${relative(workspaceRoot, outputPath)}`;
    } else {
      if (outputPath.startsWith('..')) {
        return join('{workspaceRoot}', join(projectRoot, outputPath));
      } else {
        return join('{projectRoot}', outputPath);
      }
    }
  }
}

interface RsbuildEntry {
  configFile: string;
  projectRoot: string;
  tsConfigFiles: string[];
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
        const tsConfigFiles =
          siblingFiles.filter((p) =>
            minimatch(p, 'tsconfig*{.json,.*.json}')
          ) ?? [];
        return { configFile, projectRoot, tsConfigFiles };
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
  options.typecheckTargetName ??= 'typecheck';
  return options;
}
