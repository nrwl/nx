import { join } from 'path';
import { existsSync } from 'fs';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  loadNxPlugins,
  mergePluginTargetsWithNxTargets,
} from '../../utils/nx-plugin';
import {
  ProjectGraphProcessorContext,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { mergeNpmScriptsWithTargets } from '../../utils/project-graph-utils';
import { ProjectGraphBuilder } from '../project-graph-builder';
import { PackageJson } from '../../utils/package-json';
import { readJsonFile } from '../../utils/fileutils';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { NX_PREFIX } from '../../utils/logger';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '../../config/workspaces';

export async function buildWorkspaceProjectNodes(
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder,
  nxJson: NxJsonConfiguration
) {
  const toAdd = [];
  const projects = Object.keys(ctx.projectsConfigurations.projects);

  // Used for expanding implicit dependencies (e.g. `@proj/*` or `tag:foo`)
  const partialProjectGraphNodes = projects.reduce((graph, project) => {
    const projectConfiguration = ctx.projectsConfigurations.projects[project];
    graph[project] = {
      name: project,
      type: projectConfiguration.projectType === 'library' ? 'lib' : 'app', // missing fallback to `e2e`
      data: {
        ...projectConfiguration,
      },
    };
    return graph;
  }, {} as Record<string, ProjectGraphProjectNode>);

  for (const key of projects) {
    const p = ctx.projectsConfigurations.projects[key];
    const projectRoot = join(workspaceRoot, p.root);

    if (existsSync(join(projectRoot, 'package.json'))) {
      p.targets = mergeNpmScriptsWithTargets(projectRoot, p.targets);

      try {
        const { nx }: PackageJson = readJsonFile(
          join(projectRoot, 'package.json')
        );
        if (nx?.tags) {
          p.tags = [...(p.tags || []), ...nx.tags];
        }
        if (nx?.implicitDependencies) {
          p.implicitDependencies = [
            ...(p.implicitDependencies || []),
            ...nx.implicitDependencies,
          ];
        }
        if (nx?.namedInputs) {
          p.namedInputs = { ...(p.namedInputs || {}), ...nx.namedInputs };
        }
      } catch {
        // ignore json parser errors
      }
    }

    p.implicitDependencies = normalizeImplicitDependencies(
      key,
      p.implicitDependencies,
      partialProjectGraphNodes
    );

    p.targets = mergePluginTargetsWithNxTargets(
      p.root,
      p.targets,
      await loadNxPlugins(ctx.nxJsonConfiguration.plugins)
    );

    p.targets = normalizeProjectTargets(p, nxJson.targetDefaults, key);

    // TODO: remove in v16
    const projectType =
      p.projectType === 'application'
        ? key.endsWith('-e2e') || key === 'e2e'
          ? 'e2e'
          : 'app'
        : 'lib';
    const tags = ctx.projectsConfigurations.projects?.[key]?.tags || [];

    toAdd.push({
      name: key,
      type: projectType,
      data: {
        ...p,
        tags,
      },
    });
  }

  // Sort by root directory length (do we need this?)
  toAdd.sort((a, b) => {
    if (!a.data.root) return -1;
    if (!b.data.root) return -1;
    return a.data.root.length > b.data.root.length ? -1 : 1;
  });

  toAdd.forEach((n) => {
    builder.addNode({
      name: n.name,
      type: n.type,
      data: n.data,
    });
  });
}

/**
 * Apply target defaults and normalization
 */
function normalizeProjectTargets(
  project: ProjectConfiguration,
  targetDefaults: NxJsonConfiguration['targetDefaults'],
  projectName: string
) {
  const targets = project.targets;
  for (const target in targets) {
    const executor =
      targets[target].executor ?? targets[target].command
        ? 'nx:run-commands'
        : null;

    const defaults = readTargetDefaultsForTarget(
      target,
      targetDefaults,
      executor
    );

    if (defaults) {
      targets[target] = mergeTargetConfigurations(project, target, defaults);
    }

    const config = targets[target];
    if (config.command) {
      if (config.executor) {
        throw new Error(
          `${NX_PREFIX} ${projectName}: ${target} should not have executor and command both configured.`
        );
      } else {
        targets[target] = {
          ...targets[target],
          executor,
          options: {
            ...config.options,
            command: config.command,
          },
        };
        delete config.command;
      }
    }
  }
  return targets;
}

export function normalizeImplicitDependencies(
  source: string,
  implicitDependencies: ProjectConfiguration['implicitDependencies'],
  projects: Record<string, ProjectGraphProjectNode>
) {
  if (!implicitDependencies?.length) {
    return implicitDependencies ?? [];
  }
  const matches = findMatchingProjects(implicitDependencies, projects);
  return (
    matches
      .filter((x) => x !== source)
      // implicit dependencies that start with ! should hang around, to be processed by
      // implicit-project-dependencies.ts after explicit deps are added to graph.
      .concat(implicitDependencies.filter((x) => x.startsWith('!')))
  );
}
