import { ProjectGraph, ProjectGraphBuilder, reverse } from '../project-graph';
import {
  FileChange,
  readNxJson,
  readPackageJson,
  readWorkspaceJson
} from '../file-utils';
import { NxJson } from '../shared-interfaces';
import {
  getImplicitlyTouchedProjects,
  getTouchedProjects
} from './locators/workspace-projects';
import { getTouchedNpmPackages } from './locators/npm-packages';
import { getImplicitlyTouchedProjectsByJsonChanges } from './locators/implicit-json-changes';
import {
  AffectedProjectGraphContext,
  TouchedProjectLocator
} from './affected-project-graph-models';
import { normalizeNxJson } from '../normalize-nx-json';

export function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  workspaceJson: any = readWorkspaceJson(),
  nxJson: NxJson = readNxJson(),
  packageJson: any = readPackageJson()
): ProjectGraph {
  const normalizedNxJson = normalizeNxJson(nxJson);
  // Additional affected logic should be in this array.
  const touchedProjectLocators: TouchedProjectLocator[] = [
    getTouchedProjects,
    getImplicitlyTouchedProjects,
    getTouchedNpmPackages,
    getImplicitlyTouchedProjectsByJsonChanges
  ];
  const touchedProjects = touchedProjectLocators.reduce(
    (acc, f) => {
      return acc.concat(
        f(touchedFiles, workspaceJson, normalizedNxJson, packageJson)
      );
    },
    [] as string[]
  );
  return filterAffectedProjects(graph, {
    workspaceJson,
    nxJson: normalizedNxJson,
    touchedProjects
  });
}

// -----------------------------------------------------------------------------

function filterAffectedProjects(
  graph: ProjectGraph,
  ctx: AffectedProjectGraphContext
): ProjectGraph {
  const builder = new ProjectGraphBuilder();
  const reversed = reverse(graph);
  ctx.touchedProjects.forEach(p => {
    addAffectedNodes(p, reversed, builder, []);
    addAffectedDependencies(p, reversed, builder, []);
  });
  return builder.build();
}

function addAffectedNodes(
  startingProject: string,
  reversed: ProjectGraph,
  builder: ProjectGraphBuilder,
  visited: string[]
): void {
  if (visited.indexOf(startingProject) > -1) return;
  if (!reversed.nodes[startingProject]) {
    throw new Error(`Invalid project name is detected: "${startingProject}"`);
  }
  builder.addNode(reversed.nodes[startingProject]);
  const ds = reversed.dependencies[startingProject];
  if (ds) {
    ds.forEach(({ target }) =>
      addAffectedNodes(target, reversed, builder, [...visited, startingProject])
    );
  }
}

function addAffectedDependencies(
  startingProject: string,
  reversed: ProjectGraph,
  builder: ProjectGraphBuilder,
  visited: string[]
): void {
  if (visited.indexOf(startingProject) > -1) return;
  if (reversed.dependencies[startingProject]) {
    reversed.dependencies[startingProject].forEach(({ target }) =>
      addAffectedDependencies(target, reversed, builder, [
        ...visited,
        startingProject
      ])
    );
    reversed.dependencies[startingProject].forEach(
      ({ type, source, target }) => {
        // Since source and target was reversed,
        // we need to reverse it back to original direction.
        builder.addDependency(type, target, source);
      }
    );
  }
}
