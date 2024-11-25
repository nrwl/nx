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
  testTargetName?: string;
  ciTargetName?: string;
  [taskTargetName: string]: string | undefined | boolean;
}

function normalizeOptions(options: GradlePluginOptions): GradlePluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
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
    const { buildFiles, gradlewFiles } = splitConfigFiles(files);
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
    const { nodes } = getCurrentNodesReport();

    try {
      return createNodesFromFiles(
        makeCreateNodesForGradleConfigFile(nodes, targetsCache),
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
    targetsCache: GradleTargets = {}
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
      let targetName = options?.[`${taskName}TargetName`] as string;
      if (taskName.startsWith('ci')) {
        if (options.ciTargetName) {
          targetName = taskName.replace('ci', options.ciTargetName);
          targets[targetName] = target;
          if (targetName === options.ciTargetName) {
            target.metadata.nonAtomizedTarget = options.testTargetName;
            target.dependsOn.forEach((dep) => {
              if (typeof dep !== 'string' && dep.target.startsWith('ci')) {
                dep.target = dep.target.replace('ci', options.ciTargetName);
              }
            });
          }
        }
      } else if (targetName) {
        targets[targetName] = target;
      } else {
        targets[taskName] = target;
      }
    });
    project.targets = targets;

    // rename target names in target groups if it is provided
    Object.entries(project.metadata?.targetGroups).forEach(
      ([groupName, group]) => {
        let targetGroup = group
          .map((taskName) => {
            let targetName = options?.[`${taskName}TargetName`] as string;
            if (targetName) {
              return targetName;
            } else if (options.ciTargetName && taskName.startsWith('ci')) {
              targetName = taskName.replace('ci', options.ciTargetName);
              return targetName;
            } else {
              return taskName;
            }
          })
          .filter(Boolean);
        project.metadata.targetGroups[groupName] = targetGroup;
      }
    );

    project.root = projectRoot;

    return {
      projects: {
        [projectRoot]: project,
      },
    };
  };
