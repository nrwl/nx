import {
  type ProjectConfiguration,
  type TargetConfiguration,
  readJsonFile,
  writeJsonFile,
  CreateNodesV2,
  CreateNodesContext,
  createNodesFromFiles,
  joinPathFragments,
  getPackageManagerCommand,
  detectPackageManager,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { isUsingTsSolutionSetup as _isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { existsSync, readdirSync } from 'fs';
import { join, dirname, isAbsolute, relative } from 'path';
import { minimatch } from 'minimatch';
import { loadConfig, type RsbuildConfig } from '@rsbuild/core';
import { addBuildAndWatchDepsTargets } from '@nx/js/src/plugins/typescript/util';

const pmc = getPackageManagerCommand();

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

function readTargetsCache(cachePath: string): Record<string, RsbuildTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsCache(
  cachePath,
  results?: Record<string, RsbuildTargets>
) {
  writeJsonFile(cachePath, results);
}

const rsbuildConfigGlob = '**/rsbuild.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodesV2: CreateNodesV2<RsbuildPluginOptions> = [
  rsbuildConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `rsbuild-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    const isUsingTsSolutionSetup = _isUsingTsSolutionSetup();
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(
            configFile,
            options,
            context,
            targetsCache,
            isUsingTsSolutionSetup
          ),
        configFilePaths,
        options,
        context
      );
    } finally {
      writeTargetsCache(cachePath, targetsCache);
    }
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: RsbuildPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, RsbuildTargets>,
  isUsingTsSolutionSetup: boolean
) {
  const projectRoot = dirname(configFilePath);
  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  const tsConfigFiles =
    siblingFiles.filter((p) => minimatch(p, 'tsconfig*{.json,.*.json}')) ?? [];

  const normalizedOptions = normalizeOptions(options);
  const hash = await calculateHashForCreateNodes(
    projectRoot,
    { ...normalizedOptions, isUsingTsSolutionSetup },
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= await createRsbuildTargets(
    configFilePath,
    projectRoot,
    normalizedOptions,
    tsConfigFiles,
    isUsingTsSolutionSetup,
    context
  );

  const { targets, metadata } = targetsCache[hash];

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
  context: CreateNodesContext
): Promise<RsbuildTargets> {
  const absoluteConfigFilePath = joinPathFragments(
    context.workspaceRoot,
    configFilePath
  );

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
  const buildOutputPath = normalizeOutputPath(
    rsbuildConfig?.output?.distPath?.root
      ? dirname(rsbuildConfig?.output.distPath.root)
      : undefined,
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

function normalizeOptions(options: RsbuildPluginOptions): RsbuildPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.devTargetName ??= 'dev';
  options.previewTargetName ??= 'preview';
  options.inspectTargetName ??= 'inspect';
  options.typecheckTargetName ??= 'typecheck';
  return options;
}
