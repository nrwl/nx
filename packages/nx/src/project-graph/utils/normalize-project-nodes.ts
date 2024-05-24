import { ProjectGraphProjectNode } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../project-graph-builder';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import {
  readProjectConfigurationsFromRootMap,
  resolveNxTokensInOptions,
} from '../utils/project-configuration-utils';
import { CreateDependenciesContext } from '../plugins';

export async function normalizeProjectNodes(
  { projects }: CreateDependenciesContext,
  builder: ProjectGraphBuilder
) {
  // Sorting projects by name to make sure that the order of projects in the graph is deterministic.
  // This is important to ensure that expanded properties referencing projects (e.g. implicit dependencies)
  // are also deterministic, and thus don't cause the calculated project configuration hash to shift.
  const sortedProjectNames = Object.keys(projects).sort();

  // Used for expanding implicit dependencies (e.g. `@proj/*` or `tag:foo`)
  const partialProjectGraphNodes = sortedProjectNames.reduce(
    (graph, project) => {
      const projectConfiguration = projects[project];
      graph[project] = {
        name: project,
        type: projectConfiguration.projectType === 'library' ? 'lib' : 'app', // missing fallback to `e2e`
        data: {
          ...projectConfiguration,
        },
      };
      return graph;
    },
    {} as Record<string, ProjectGraphProjectNode>
  );

  const toAdd = [];

  for (const key of sortedProjectNames) {
    const p = projects[key];

    p.implicitDependencies = normalizeImplicitDependencies(
      key,
      p.implicitDependencies,
      partialProjectGraphNodes
    );

    p.targets = normalizeProjectTargets(p, key);

    // TODO: remove in v16
    const projectType =
      p.projectType === 'application'
        ? key.endsWith('-e2e') || key === 'e2e'
          ? 'e2e'
          : 'app'
        : 'lib';
    const tags = p.tags || [];

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
export function normalizeProjectTargets(
  project: ProjectConfiguration,
  projectName: string
): Record<string, TargetConfiguration> {
  // Any node on the graph will have a targets object, it just may be empty
  const targets = project.targets ?? {};

  for (const target in targets) {
    if (!targets[target].command && !targets[target].executor) {
      delete targets[target];
      continue;
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
