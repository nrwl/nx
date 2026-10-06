import { calculateHashesForCreateNodes } from '@nx/devkit/internal';
import {
  CreateNodes,
  CreateNodesContext,
  ProjectConfiguration,
  workspaceRoot,
  ProjectGraphExternalNode,
  normalizePath,
  logger,
} from '@nx/devkit';
import { dirname, isAbsolute, join } from 'node:path';

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

export const createNodes: CreateNodes<GradlePluginOptions> = [
  gradleConfigAndTestGlob,
  async (files, options, context) => {
    const { gradlewFiles } = splitConfigFiles(files);

    await populateProjectGraph(
      context.workspaceRoot,
      gradlewFiles.map((f) => join(context.workspaceRoot, f)),
      options
    );
    const report = getCurrentProjectGraphReport();
    const { nodes, externalNodes = {}, buildFileByProjectRoot = {} } = report;

    const results = [];

    // Roots outside the workspace stay absolute in the report and cannot become Nx projects.
    const projectRoots = Object.keys(nodes)
      .map((root) => normalizePath(root))
      .filter((root) => !isAbsolute(root) && !root.startsWith('../'));

    for (const normalizedProjectRoot of projectRoots) {
      const gradleFilePath = buildFileByProjectRoot[normalizedProjectRoot];
      if (!gradleFilePath) {
        // No build file anywhere up the ancestry, or an ancestor configures it and the plugin
        // predates effectiveBuildFile.
        logger.verbose(
          `[@nx/gradle] no build file reported for "${normalizedProjectRoot}"; skipping it. Add a build file (or run @nx/gradle:init), or upgrade dev.nx.gradle.project-graph if projects are missing.`
        );
        continue;
      }
      const project = nodes[normalizedProjectRoot];
      if (!project) {
        continue;
      }

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
  },
];

/**
 * @deprecated Use {@link createNodes} instead. This will be removed in Nx 24.
 */
export const createNodesV2 = createNodes;

export const makeCreateNodesForGradleConfigFile =
  (
    projects: Record<string, Partial<ProjectConfiguration>>,
    projectsCache: GradleTargets = {},
    externalNodes: Record<string, ProjectGraphExternalNode> = {},
    hashes?: string[]
  ) =>
  async (
    gradleFilePath,
    options: GradlePluginOptions | undefined,
    context: CreateNodesContext,
    idx?: number
  ) => {
    const projectRoot = dirname(gradleFilePath);
    options = normalizeOptions(options);

    let hash: string;
    if (hashes && idx !== undefined) {
      hash = hashes[idx];
      if (hash === undefined) {
        throw new Error(
          `Failed to compute hash for gradle project at ${projectRoot}`
        );
      }
    } else {
      const [computed] = await calculateHashesForCreateNodes(
        [projectRoot],
        options ?? {},
        context
      );
      if (computed === undefined) {
        throw new Error(
          `Failed to compute hash for gradle project at ${projectRoot}`
        );
      }
      hash = computed;
    }
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
