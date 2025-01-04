import {
  CreateNodesV2,
  CreateNodesContext,
  ProjectConfiguration,
  createNodesFromFiles,
  readJsonFile,
  writeJsonFile,
  CreateNodesFunction,
  joinPathFragments,
  workspaceRoot,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';

import { hashObject } from 'nx/src/hasher/file-hasher';
import {
  gradleConfigAndTestGlob,
  splitConfigFiles,
} from '../utils/split-config-files';
import {
  getCurrentNodesReport,
  populateNodes,
} from './utils/get-nodes-from-gradle-plugin';

export interface GradlePluginOptions {
  ciTargetName?: string;
  testTargetName?: string;
  classesTargetName?: string;
  buildTargetName?: string;
  [taskTargetName: string]: string | undefined | boolean;
}

function normalizeOptions(options: GradlePluginOptions): GradlePluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  options.classesTargetName ??= 'classes';
  options.buildTargetName ??= 'build';
  return options;
}

type GradleTargets = Record<string, Partial<ProjectConfiguration>>;

function readTargetsCache(cachePath: string): GradleTargets {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

export function writeTargetsToCache(cachePath: string, results: GradleTargets) {
  writeJsonFile(cachePath, results);
}

export const createNodesV2: CreateNodesV2<GradlePluginOptions> = [
  gradleConfigAndTestGlob,
  async (files, options, context) => {
    const { buildFiles, projectRoots, gradlewFiles, testFiles } =
      splitConfigFiles(files);
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `gradle-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    await populateNodes(
      context.workspaceRoot,
      gradlewFiles.map((f) => join(context.workspaceRoot, f))
    );
    const { projects } = getCurrentNodesReport();

    try {
      return createNodesFromFiles(
        makeCreateNodesForGradleConfigFile(projects, targetsCache),
        buildFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const makeCreateNodesForGradleConfigFile =
  (
    projects: Record<string, Partial<ProjectConfiguration>>,
    targetsCache: GradleTargets = {},
    gradleProjectRootToTestFilesMap: Record<string, string[]> = {}
  ): CreateNodesFunction =>
  async (
    gradleFilePath,
    options: GradlePluginOptions | undefined,
    context: CreateNodesContext
  ) => {
    const projectRoot = dirname(gradleFilePath);
    options = normalizeOptions(options);

    const hash = await calculateHashForCreateNodes(
      projectRoot,
      options ?? {},
      context
    );
    targetsCache[hash] ??=
      projects[projectRoot] ??
      projects[joinPathFragments(workspaceRoot, projectRoot)];
    const project = targetsCache[hash];
    if (!project) {
      return {};
    }

    let targets = {};
    // rename target name if it is provided
    Object.entries(project.targets).forEach(([taskName, target]) => {
      const targetName = options?.[`${taskName}TargetName`] as string;
      if (targetName) {
        targets[targetName] = target;
      } else {
        targets[taskName] = target;
      }
    });
    project.targets = targets;
    project.root = projectRoot;

    return {
      projects: {
        [projectRoot]: project,
      },
    };
  };
