import {
  type CreateNodesV2,
  type ProjectConfiguration,
  type TargetConfiguration,
  createNodesFromFiles,
  readJsonFile,
  writeJsonFile,
  CreateNodesContext,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';

interface ExpandedBuildTargetOptions {
  name?: string;
  setImageName?: boolean;
}

type BuildTargetOptions = string | ExpandedBuildTargetOptions;

export interface DockerPluginOptions {
  buildTarget?: BuildTargetOptions;
}

interface NormalizedDockerPluginOptions {
  buildTarget: ExpandedBuildTargetOptions;
}

type DockerTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(cachePath: string): Record<string, DockerTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsCache(
  cachePath: string,
  results?: Record<string, DockerTargets>
) {
  writeJsonFile(cachePath, results ?? {});
}

const dockerfileGlob = '**/Dockerfile';

export const createNodesV2: CreateNodesV2<DockerPluginOptions> = [
  dockerfileGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `docker-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
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
  options: DockerPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, DockerTargets>
) {
  const projectRoot = dirname(configFilePath);
  const normalizedOptions = normalizePluginOptions(options);
  const hash = await calculateHashForCreateNodes(
    projectRoot,
    normalizedOptions,
    context
  );

  targetsCache[hash] ??= await createDockerTargets(
    projectRoot,
    normalizedOptions,
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

async function createDockerTargets(
  projectRoot: string,
  options: NormalizedDockerPluginOptions,
  context: CreateNodesContext
) {
  const namedInputs = getNamedInputs(projectRoot, context);
  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTarget.name] = {
    command: `docker build .`,
    options: {
      cwd: projectRoot,
      args: options.buildTarget.setImageName
        ? [`--tag ${basename(projectRoot)}`]
        : [],
    },
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
    ],
    metadata: {
      technologies: ['docker'],
      description: `Run Docker build`,
      help: {
        command: `docker build --help`,
        example: {},
      },
    },
  };

  return { targets, metadata: {} };
}

function normalizePluginOptions(
  options: DockerPluginOptions
): NormalizedDockerPluginOptions {
  return {
    buildTarget: normalizeBuildTarget(options),
  };
}

function normalizeBuildTarget({
  buildTarget,
}: DockerPluginOptions): ExpandedBuildTargetOptions {
  if (!buildTarget) {
    return {
      name: 'docker:build',
      setImageName: true,
    };
  } else if (typeof buildTarget === 'string') {
    return {
      name: buildTarget,
      setImageName: true,
    };
  } else {
    return {
      name: buildTarget.name,
      setImageName: buildTarget.setImageName,
    };
  }
}
