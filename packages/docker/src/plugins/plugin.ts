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
  name: string;
}
type BuildTargetOptions = string | Partial<ExpandedBuildTargetOptions>;

interface ExpandedRunTargetOptions {
  name: string;
}
type RunTargetOptions = string | Partial<ExpandedRunTargetOptions>;

interface DockerPushRegistryOptions {
  registryUrl: string;
  repositoryName: string;
  tag: string;
}

interface ExpandedPushTargetOptions extends Partial<DockerPushRegistryOptions> {
  name: string;
  environments: Record<string, DockerPushRegistryOptions>;
}

type PushTargetOptions = string | Partial<ExpandedPushTargetOptions>;

export interface DockerPluginOptions {
  buildTarget?: BuildTargetOptions;
  runTarget?: RunTargetOptions;
  pushTarget?: PushTargetOptions;
}

interface NormalizedDockerPluginOptions {
  buildTarget: ExpandedBuildTargetOptions;
  runTarget: ExpandedRunTargetOptions;
  pushTarget: ExpandedPushTargetOptions;
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

  let customRegistryTag = `${options.pushTarget.tag}`;
  if (options.pushTarget.repositoryName) {
    customRegistryTag = `${options.pushTarget.repositoryName}:${customRegistryTag}`;
  }
  if (options.pushTarget.registryUrl) {
    customRegistryTag = `${options.pushTarget.registryUrl}/${customRegistryTag}`;
  }
  targets[`docker:prepush`] = {
    dependsOn: [options.buildTarget.name],
    command: `docker tag ${imageTag} ${customRegistryTag}`,
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
      description: `Run Docker tag to retag existing image for pushing to registry.`,
      help: {
        command: `docker tag --help`,
        example: {},
      },
    },
  };

  targets[options.pushTarget.name] = {
    dependsOn: [`docker:prepush`],
    command: `docker push ${customRegistryTag}`,
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
      description: `Run Docker push to push image to registry.`,
      help: {
        command: `docker push --help`,
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
    pushTarget: normalizePushTarget(options),
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
      name: buildTarget.name ?? 'docker:build',
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
      name: runTarget.name ?? 'docker:run',
    };
  }
}

function normalizePushTarget({
  pushTarget,
}: DockerPluginOptions): ExpandedPushTargetOptions {
  if (!pushTarget) {
    return {
      name: 'docker:push',
      registryUrl: undefined,
      repositoryName: undefined,
      tag: 'latest',
      environments: undefined,
    };
  } else if (typeof pushTarget === 'string') {
    return {
      name: pushTarget,
      registryUrl: undefined,
      repositoryName: undefined,
      tag: 'latest',
      environments: undefined,
    };
  } else {
    return {
      name: pushTarget.name ?? 'docker:push',
      registryUrl: pushTarget.registryUrl ?? undefined,
      repositoryName: pushTarget.repositoryName ?? undefined,
      tag: pushTarget.tag ?? 'latest',
      environments: pushTarget.environments ?? undefined,
    };
  }
}
