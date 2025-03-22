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
  ProjectGraphExternalNode,
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
  getCurrentProjectGraphReport,
  populateProjectGraph,
} from './utils/get-project-graph-from-gradle-plugin';
import {
  GradlePluginOptions,
  normalizeOptions,
} from './utils/gradle-plugin-options';
import {
  replaceTargeGroupNameWithOptions,
  replaceTargetNameWithOptions,
} from './utils/create-ci-targets';
import { findGraldewFile } from '../utils/exec-gradle';

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

    await populateProjectGraph(
      context.workspaceRoot,
      gradlewFiles.map((f) => join(context.workspaceRoot, f))
    );
    const { nodes, externalNodes } = getCurrentProjectGraphReport();

    try {
      return createNodesFromFiles(
        makeCreateNodesForGradleConfigFile(nodes, targetsCache, externalNodes),
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
    externalNodes: Record<string, ProjectGraphExternalNode> = {}
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

    const gradlewFileDirectory = dirname(
      findGraldewFile(gradleFilePath, context.workspaceRoot)
    );

    project.targets = replaceTargetNameWithOptions(
      project.targets,
      options,
      gradlewFileDirectory
    );
    if (project.metadata?.targetGroups) {
      replaceTargeGroupNameWithOptions(project.metadata?.targetGroups, options);
    }
    project.root = projectRoot;

    return {
      projects: {
        [projectRoot]: project,
      },
      externalNodes: externalNodes,
    };
  };
