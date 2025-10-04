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
import { getLatestCommitSha } from 'nx/src/utils/git-utils';
import { interpolateObject } from '../utils/interpolate-pattern';

export interface DockerTargetOptions {
  name: string;
  args?: string[];
  env?: Record<string, string>;
  envFile?: string;
  cwd?: string;
}

export interface DockerPluginOptions {
  buildTarget?: string | DockerTargetOptions;
  runTarget?: string | DockerTargetOptions;
}

interface NormalizedDockerPluginOptions {
  buildTarget: DockerTargetOptions;
  runTarget: DockerTargetOptions;
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
    const projectRoots = configFilePaths.map((c) => dirname(c));
    const normalizedOptions = normalizePluginOptions(options);
    // TODO(colum): investigate hashing only the dockerfile
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

function interpolateDockerTargetOptions(
  options: DockerTargetOptions,
  projectRoot: string,
  imageRef: string,
  context: CreateNodesContext
): DockerTargetOptions {
  const commitSha = getLatestCommitSha();
  const projectName = getProjectName(projectRoot, context.workspaceRoot);

  const tokens = {
    projectRoot,
    projectName,
    imageRef,
    currentDate: new Date(),
    commitSha,
    shortCommitSha: commitSha.slice(0, 7),
  };

  return interpolateObject(options, tokens);
}

function getProjectName(projectRoot: string, workspaceRoot: string): string {
  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  if (existsSync(projectJsonPath)) {
    const projectJson = readJsonFile(projectJsonPath);
    if (projectJson.name) {
      return projectJson.name;
    }
  }

  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = readJsonFile(packageJsonPath);
    if (packageJson.name) {
      return packageJson.name;
    }
  }

  return projectRoot.replace(/^[\\/]/, '').replace(/[\\/\s]+/g, '-');
}

async function createDockerTargets(
  projectRoot: string,
  options: NormalizedDockerPluginOptions,
  context: CreateNodesContext
) {
  const imageRef = projectRoot.replace(/^[\\/]/, '').replace(/[\\/\s]+/g, '-');

  const interpolatedBuildTarget = interpolateDockerTargetOptions(
    options.buildTarget,
    projectRoot,
    imageRef,
    context
  );
  const interpolatedRunTarget = interpolateDockerTargetOptions(
    options.runTarget,
    projectRoot,
    imageRef,
    context
  );

  const namedInputs = getNamedInputs(projectRoot, context);
  const targets: Record<string, TargetConfiguration> = {};
  const metadata = {
    targetGroups: {
      ['Docker']: [
        interpolatedBuildTarget.name,
        interpolatedRunTarget.name,
        'nx-release-publish',
      ],
    },
  };

  const buildOptions = {
    cwd: interpolatedBuildTarget.cwd ?? projectRoot,
    args: [`--tag ${imageRef}`, ...(interpolatedBuildTarget.args ?? [])],
    ...(interpolatedBuildTarget.env && { env: interpolatedBuildTarget.env }),
    ...(interpolatedBuildTarget.envFile && {
      envFile: interpolatedBuildTarget.envFile,
    }),
  };

  targets[interpolatedBuildTarget.name] = {
    dependsOn: ['build', '^build'],
    command: `docker build .`,
    options: buildOptions,
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

  const runOptions = {
    cwd: interpolatedRunTarget.cwd ?? projectRoot,
    ...(interpolatedRunTarget.args && { args: interpolatedRunTarget.args }),
    ...(interpolatedRunTarget.env && { env: interpolatedRunTarget.env }),
    ...(interpolatedRunTarget.envFile && {
      envFile: interpolatedRunTarget.envFile,
    }),
  };

  targets[interpolatedRunTarget.name] = {
    dependsOn: [interpolatedBuildTarget.name],
    command: `docker run {args} ${imageRef}`,
    options: runOptions,
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

  return { targets, metadata };
}

function normalizePluginOptions(
  options: DockerPluginOptions
): NormalizedDockerPluginOptions {
  const normalizeTarget = (
    target: string | DockerTargetOptions | undefined,
    defaultName: string
  ): DockerTargetOptions => {
    if (typeof target === 'string') {
      return { name: target };
    }
    if (target && typeof target === 'object') {
      return { ...target, name: target.name ?? defaultName };
    }
    return { name: defaultName };
  };

  return {
    buildTarget: normalizeTarget(options.buildTarget, 'docker:build'),
    runTarget: normalizeTarget(options.runTarget, 'docker:run'),
  };
}
