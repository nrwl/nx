import {
  type CreateNodesV2,
  type ProjectConfiguration,
  type TargetConfiguration,
  createNodesFromFiles,
  readJsonFile,
  writeJsonFile,
  CreateNodesContext,
} from '@nx/devkit';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';

export interface DockerPluginOptions {
  buildTarget?: string;
  runTarget?: string;
}

interface NormalizedDockerPluginOptions {
  buildTarget: string;
  runTarget: string;
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

const dockerfileGlob = 'Dockerfile,**/Dockerfile';

export const createNodesV2: CreateNodesV2<DockerPluginOptions> = [
  dockerfileGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `docker-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    const projectRoots = configFilePaths.map((c) => dirname(c));
    const normalizedOptions = normalizePluginOptions(options);
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      normalizedOptions,
      context
    );
    try {
      return await createNodesFromFiles(
        (configFile, _, context, idx) =>
          createNodesInternal(
            configFile,
            hashes[idx] + configFile,
            normalizedOptions,
            context,
            targetsCache
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
  hash: string,
  normalizedOptions: NormalizedDockerPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, DockerTargets>
) {
  const projectRoot = dirname(configFilePath);

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
  const imageRef = projectRoot.replace(/^[\\/]/, '').replace(/[\\/\s]+/g, '-');

  const namedInputs = getNamedInputs(projectRoot, context);
  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTarget] = {
    command: `docker build .`,
    options: {
      cwd: projectRoot,
      args: [`--tag ${imageRef}`],
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
        example: {
          options: {
            'cache-from': 'type=s3,region=eu-west-1,bucket=mybucket .',
            'cache-to': 'type=s3,region=eu-west-1,bucket=mybucket .',
          },
        },
      },
    },
  };

  targets[options.runTarget] = {
    dependsOn: [options.buildTarget],
    command: `docker run {args} ${imageRef}`,
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
        example: {
          options: {
            args: ['-p', '3000:3000'],
          },
        },
      },
    },
  };

  targets['nx-release-publish'] = {
    executor: '@nx/docker:release-publish',
  };

  return { targets, metadata: {} };
}

function normalizePluginOptions(
  options: DockerPluginOptions
): NormalizedDockerPluginOptions {
  return {
    buildTarget: options.buildTarget ?? 'docker:build',
    runTarget: options.runTarget ?? 'docker:run',
  };
}
