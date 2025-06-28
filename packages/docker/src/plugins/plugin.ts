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
import { DockerVersionActionsOptions } from '../release/version-actions-options';

interface ExpandedBuildTargetOptions {
  name: string;
}
type BuildTargetOptions = string | Partial<ExpandedBuildTargetOptions>;

interface ExpandedRunTargetOptions {
  name: string;
}
type RunTargetOptions = string | Partial<ExpandedRunTargetOptions>;

interface DockerRegistryOptions {
  registry?: string;
  repositoryName?: string;
  versionPattern?: string;
}

interface ExpandedPushTargetOptions {
  name: string;
}

type PushTargetOptions = string | Partial<ExpandedPushTargetOptions>;

export interface DockerPluginOptions {
  buildTarget?: BuildTargetOptions;
  runTarget?: RunTargetOptions;
  pushTarget?: PushTargetOptions;
  registryOptions?: DockerRegistryOptions;
}

interface NormalizedDockerPluginOptions {
  buildTarget: ExpandedBuildTargetOptions;
  runTarget: ExpandedRunTargetOptions;
  pushTarget: ExpandedPushTargetOptions;
  registryOptions: DockerRegistryOptions;
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
  const versionActionsOptions: DockerVersionActionsOptions = {
    ...normalizedOptions.registryOptions,
    versionPattern:
      normalizedOptions.registryOptions?.versionPattern ??
      '{currentDate|YYMM.DD}.{shortCommitSha}',
  };

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets,
        metadata,
        release: {
          version: {
            versionActions: '@nx/docker/release/version-actions',
            versionActionsOptions: versionActionsOptions as Record<
              string,
              unknown
            >,
          },
        },
      },
    },
  };
}

async function createDockerTargets(
  projectRoot: string,
  options: NormalizedDockerPluginOptions,
  context: CreateNodesContext
) {
  const imageRef = projectRoot.replace(/^[\\/]/, '').replace(/[\\/\s]+/g, '-');
  const ociOutputPath = `${imageRef}.oci`;

  const namedInputs = getNamedInputs(projectRoot, context);
  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTarget.name] = {
    command: `docker build .`,
    cache: true,
    options: {
      cwd: projectRoot,
      args: [
        `--tag ${imageRef}`,
        `--output type=image,name=${imageRef}`,
        `--output type=oci,dest=${ociOutputPath},name=${imageRef}`,
      ],
    },
    outputs: [`{projectRoot}/${ociOutputPath}`],
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

  targets[`docker:load`] = {
    dependsOn: [options.buildTarget.name],
    command: `docker load -i ${ociOutputPath}`,
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
      description: `Run Docker load`,
      help: {
        command: `docker load --help`,
        example: {},
      },
    },
  };

  targets[options.runTarget.name] = {
    dependsOn: [`docker:load`],
    command: `docker run ${imageRef}`,
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

  let customRegistryRef = ``;
  if (options.registryOptions.repositoryName) {
    customRegistryRef = `${options.registryOptions.repositoryName}`;
  }
  if (options.registryOptions.registry) {
    customRegistryRef = `${options.registryOptions.registry}/${customRegistryRef}`;
  }
  targets[`docker:prepush`] = {
    dependsOn: [`docker:load`],
    command: `docker tag ${imageRef} ${customRegistryRef}`,
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
    command: `docker push ${customRegistryRef}`,
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

  targets['nx-release-publish'] = {
    executor: '@nx/docker:release-publish',
    options: {
      registry: options.registryOptions.registry,
      repositoryName: options.registryOptions.repositoryName,
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
    registryOptions: options.registryOptions ?? {},
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
    };
  } else if (typeof pushTarget === 'string') {
    return {
      name: pushTarget,
    };
  } else {
    return {
      name: pushTarget.name ?? 'docker:push',
    };
  }
}
