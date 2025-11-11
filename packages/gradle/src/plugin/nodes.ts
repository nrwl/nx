import {
  CreateNodesV2,
  CreateNodesContextV2,
  ProjectConfiguration,
  readJsonFile,
  writeJsonFile,
  workspaceRoot,
  ProjectGraphExternalNode,
  normalizePath,
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

/**
 * Strips nxConfig from project and all targets, returning only Gradle-detected configuration.
 */
function stripNxConfig(
  project: Partial<ProjectConfiguration>
): Partial<ProjectConfiguration> {
  const { nxConfig, targets, ...rest } =
    project as Partial<ProjectConfiguration> & {
      nxConfig?: Record<string, any>;
    };

  const cleanedTargets: Record<string, any> = {};
  if (targets) {
    for (const [targetName, target] of Object.entries(targets)) {
      const { nxConfig: targetNxConfig, ...targetRest } = target as any;
      cleanedTargets[targetName] = targetRest;
    }
  }

  return {
    ...rest,
    targets: cleanedTargets,
  };
}

/**
 * Extracts only nxConfig properties from project and targets.
 * Returns undefined if no nxConfig exists.
 */
function extractNxConfigOnly(
  project: Partial<ProjectConfiguration>
): Partial<ProjectConfiguration> | undefined {
  const projectWithNxConfig = project as Partial<ProjectConfiguration> & {
    nxConfig?: Record<string, any>;
  };

  const projectLevelNxConfig = projectWithNxConfig.nxConfig;
  const targetsWithNxConfig: Record<string, any> = {};
  let hasAnyNxConfig = false;

  // Extract target-level nxConfig
  if (project.targets) {
    for (const [targetName, target] of Object.entries(project.targets)) {
      const targetNxConfig = (target as any).nxConfig;
      if (targetNxConfig && Object.keys(targetNxConfig).length > 0) {
        targetsWithNxConfig[targetName] = targetNxConfig;
        hasAnyNxConfig = true;
      }
    }
  }

  // Check if we have project-level nxConfig
  if (projectLevelNxConfig && Object.keys(projectLevelNxConfig).length > 0) {
    hasAnyNxConfig = true;
  }

  if (!hasAnyNxConfig) {
    return undefined;
  }

  // Build result with only nxConfig properties
  let result: Partial<ProjectConfiguration> = {};

  // Merge project-level nxConfig into root
  if (projectLevelNxConfig) {
    result = {
      ...projectLevelNxConfig,
    };
  }

  // Add target-level nxConfig if any exist
  if (Object.keys(targetsWithNxConfig).length > 0) {
    result.targets = targetsWithNxConfig;
  }

  return result;
}

export function writeTargetsToCache(cachePath: string, results: GradleTargets) {
  writeJsonFile(cachePath, results);
}

export const createNodesV2: CreateNodesV2<GradlePluginOptions> = [
  gradleConfigAndTestGlob,
  async (files, options, context) => {
    const { buildFiles: buildFilesFromSplitConfigFiles, gradlewFiles } =
      splitConfigFiles(files);
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
    const report = getCurrentProjectGraphReport();
    const { nodes, externalNodes, buildFiles = [] } = report;

    // Combine buildFilesFromSplitConfigFiles and buildFiles, making each value distinct
    const allBuildFiles = Array.from(
      new Set([...buildFilesFromSplitConfigFiles, ...buildFiles])
    );

    try {
      const results = [];
      const normalizedOptions = normalizeOptions(options);

      for (const gradleFilePath of allBuildFiles) {
        // Skip on Vercel and Netlify
        if (process.env.VERCEL || process.env.NETLIFY) {
          continue;
        }

        const projectRoot = dirname(gradleFilePath);
        const hash = await calculateHashForCreateNodes(
          projectRoot,
          normalizedOptions ?? {},
          context
        );

        // Get project from cache or nodes
        projectsCache[hash] ??=
          nodes[projectRoot] ?? nodes[join(workspaceRoot, projectRoot)];
        const project = projectsCache[hash];

        if (!project) {
          continue;
        }

        const normalizedProjectRoot = normalizePath(projectRoot);

        // Result 1: Gradle-detected configuration (without nxConfig)
        const gradleConfig = stripNxConfig(project);
        gradleConfig.root = normalizedProjectRoot;

        results.push([
          gradleFilePath,
          {
            projects: {
              [normalizedProjectRoot]: gradleConfig,
            },
            externalNodes: externalNodes,
          },
        ]);

        // Result 2: nxConfig-only configuration (if exists)
        const nxConfigOnly = extractNxConfigOnly(project);
        if (nxConfigOnly) {
          nxConfigOnly.root = normalizedProjectRoot;

          results.push([
            gradleFilePath,
            {
              projects: {
                [normalizedProjectRoot]: nxConfigOnly,
              },
            },
          ]);
        }
      }

      return results;
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
  ) =>
  async (
    gradleFilePath,
    options: GradlePluginOptions | undefined,
    context: CreateNodesContextV2
  ) => {
    // Vercel does not allow JAVA_VERSION to be set, skip on Vercel
    if (process.env.VERCEL) return {};

    // Netlify only supports Java 8 but we require 17, skip on Netlify
    if (process.env.NETLIFY) return {};

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
    const normalizedProjectRoot = normalizePath(projectRoot);
    project.root = normalizedProjectRoot;

    return {
      projects: {
        [normalizedProjectRoot]: project,
      },
      externalNodes: externalNodes,
    };
  };
