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
}
type BuildTargetOptions = string | ExpandedBuildTargetOptions;

interface ExpandedRunTargetOptions {
  name?: string;
}
type RunTargetOptions = string | ExpandedRunTargetOptions;

export interface DockerPluginOptions {
  buildTarget?: BuildTargetOptions;
  runTarget?: RunTargetOptions;
}

interface NormalizedDockerPluginOptions {
  buildTarget: ExpandedBuildTargetOptions;
  runTarget: ExpandedRunTargetOptions;
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
  const imageTag = projectRoot.replace(/^[\\/]/, '').replace(/[\\/\s]+/g, '-');
  const namedInputs = getNamedInputs(projectRoot, context);
  const targets: Record<string, TargetConfiguration> = {};
  targets[options.buildTarget.name] = {
    command: `docker build .`,
    options: {
      cwd: projectRoot,
      args: [`--tag ${imageTag}`],
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

  targets[options.runTarget.name] = {
    dependsOn: [options.buildTarget.name],
    command: `docker run ${imageTag}`,
    options: {
      cwd: projectRoot,
    },
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
    ],
    metadata: {
      technologies: ['docker'],
      description: `Run Docker run`,
      help: {
        command: `docker run --help`,
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
    runTarget: normalizeRunTarget(options),
  };
}

function normalizeBuildTarget({
  buildTarget,
}: DockerPluginOptions): ExpandedBuildTargetOptions {
  if (!buildTarget) {
    return {
      name: 'docker:build',
    };
  } else if (typeof buildTarget === 'string') {
    return {
      name: buildTarget,
    };
  } else {
    return {
      name: buildTarget.name,
    };
  }
}

function normalizeRunTarget({
  runTarget,
}: DockerPluginOptions): ExpandedRunTargetOptions {
  if (!runTarget) {
    return {
      name: 'docker:run',
    };
  } else if (typeof runTarget === 'string') {
    return {
      name: runTarget,
    };
  } else {
    return {
      name: runTarget.name,
    };
  }
}
