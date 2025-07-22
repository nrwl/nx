import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectGraphProjectNode } from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { readJsonFile } from '../../utils/fileutils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import type { PackageJson } from '../../utils/package-json';
import type { CreateDependenciesContext } from '../plugins';
import type { ProjectGraphBuilder } from '../project-graph-builder';

export async function normalizeProjectNodes(
  { projects, workspaceRoot }: CreateDependenciesContext,
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

    p.targets ??= {};

    // TODO: remove in v16
    const projectType = getProjectType(
      key,
      p.projectType,
      workspaceRoot,
      p.root
    );
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

export function normalizeImplicitDependencies(
  source: string,
  implicitDependencies: ProjectConfiguration['implicitDependencies'],
  projects: Record<string, ProjectGraphProjectNode>
) {
  if (!implicitDependencies?.length) {
    return implicitDependencies ?? [];
  }

  // Implicit dependencies handle negatives in a different
  // way from most other `projects` fields. This is because
  // they are used for multiple purposes.
  const positivePatterns: string[] = [];
  const negativePatterns: string[] = [];

  for (const dep of implicitDependencies) {
    if (dep.startsWith('!')) {
      negativePatterns.push(dep);
    } else {
      positivePatterns.push(dep);
    }
  }

  // Finds all projects that match a positive pattern and are not excluded by a negative pattern
  const deps = positivePatterns.length
    ? findMatchingProjects(
        positivePatterns.concat(negativePatterns),
        projects
      ).filter((x) => x !== source)
    : [];

  // Expands negative patterns to equal project names
  const alwaysIgnoredDeps = findMatchingProjects(
    negativePatterns.map((x) => x.slice(1)),
    projects
  );

  // We return the matching deps, but keep the negative patterns in the list
  // so that they can be processed later by implicit-project-dependencies.ts
  // This is what allows using a negative implicit dep to remove a dependency
  // detected by createDependencies.
  return deps.concat(alwaysIgnoredDeps.map((x) => '!' + x)) as string[];
}

function getProjectType(
  projectName: string,
  projectType: 'library' | 'application' | undefined,
  workspaceRoot: string,
  projectRoot: string
): 'lib' | 'app' | 'e2e' {
  if (projectType) {
    if (projectType === 'library') {
      return 'lib';
    }
    if (projectName.endsWith('-e2e') || projectName === 'e2e') {
      return 'e2e';
    }
    return 'app';
  }

  if (existsSync(join(workspaceRoot, projectRoot, 'tsconfig.lib.json'))) {
    return 'lib';
  }

  if (existsSync(join(workspaceRoot, projectRoot, 'tsconfig.app.json'))) {
    return 'app';
  }

  // If there are no exports, assume it is an application since both buildable and non-buildable libraries have exports.
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  try {
    const packageJson = readJsonFile<PackageJson>(packageJsonPath);
    if (!packageJson.exports) {
      return 'app';
    }
  } catch {}

  return 'lib';
}
