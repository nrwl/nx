import {
  CreateNodesV2,
  CreateNodesContext,
  ProjectConfiguration,
  createNodesFromFiles,
  readJsonFile,
  writeJsonFile,
  CreateNodesFunction,
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

type GradleTargets = Record<string, Partial<ProjectConfiguration>>;

function readProjectsCache(cachePath: string): GradleTargets {
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
    const projectsCache = readProjectsCache(cachePath);

    await populateProjectGraph(
      context.workspaceRoot,
      gradlewFiles.map((f) => join(context.workspaceRoot, f)),
      options
    );
    const { nodes, externalNodes } = getCurrentProjectGraphReport();

    try {
      return createNodesFromFiles(
        makeCreateNodesForGradleConfigFile(nodes, projectsCache, externalNodes),
        buildFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, projectsCache);
    }
  },
];

export const makeCreateNodesForGradleConfigFile =
  (
    projects: Record<string, Partial<ProjectConfiguration>>,
    projectsCache: GradleTargets = {},
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
    projectsCache[hash] ??=
      projects[projectRoot] ?? projects[join(workspaceRoot, projectRoot)];
    const project = projectsCache[hash];
    if (!project) {
      return {};
    }
    project.root = projectRoot;

    return {
      projects: {
        [projectRoot]: project,
      },
      externalNodes: externalNodes,
    };
  };
