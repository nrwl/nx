import {
  FileChange,
  readNxJson,
  readPackageJson,
  readWorkspaceJson,
} from '../file-utils';
import {
  getImplicitlyTouchedProjects,
  getTouchedProjects,
} from './locators/workspace-projects';
import { getTouchedNpmPackages } from './locators/npm-packages';
import { getImplicitlyTouchedProjectsByJsonChanges } from './locators/implicit-json-changes';
import {
  AffectedProjectGraphContext,
  TouchedProjectLocator,
} from './affected-project-graph-models';
import { normalizeNxJson } from '../normalize-nx-json';
import { getTouchedProjectsInWorkspaceJson } from './locators/workspace-json-changes';
import { getTouchedProjectsFromTsConfig } from './locators/tsconfig-json-changes';
import { WorkspaceJsonConfiguration } from 'nx/src/shared/workspace';
import { NxJsonConfiguration } from 'nx/src/shared/nx';
import { ProjectGraph } from 'nx/src/shared/project-graph';
import { reverse } from '../project-graph/operators';

export function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  workspaceJson: WorkspaceJsonConfiguration = readWorkspaceJson(),
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: any = readPackageJson()
): ProjectGraph {
  const normalizedNxJson = normalizeNxJson(
    nxJson,
    Object.keys(workspaceJson.projects)
  );
  // Additional affected logic should be in this array.
  const touchedProjectLocators: TouchedProjectLocator[] = [
    getTouchedProjects,
    getImplicitlyTouchedProjects,
    getTouchedNpmPackages,
    getImplicitlyTouchedProjectsByJsonChanges,
    getTouchedProjectsInWorkspaceJson,
    getTouchedProjectsFromTsConfig,
  ];
  const touchedProjects = touchedProjectLocators.reduce((acc, f) => {
    return acc.concat(
      f(touchedFiles, workspaceJson, normalizedNxJson, packageJson, graph)
    );
  }, [] as string[]);

  return filterAffectedProjects(graph, {
    workspaceJson,
    nxJson: normalizedNxJson,
    touchedProjects,
  });
}

// -----------------------------------------------------------------------------

function filterAffectedProjects(
  graph: ProjectGraph,
  ctx: AffectedProjectGraphContext
): ProjectGraph {
  const result: ProjectGraph = {
    nodes: {},
    externalNodes: {},
    dependencies: {},
  };
  const reversed = reverse(graph);
  ctx.touchedProjects.forEach((p) => {
    addAffectedNodes(p, reversed, result, []);
  });
  ctx.touchedProjects.forEach((p) => {
    addAffectedDependencies(p, reversed, result, []);
  });
  return result;
}

function addAffectedNodes(
  startingProject: string,
  reversed: ProjectGraph,
  result: ProjectGraph,
  visited: string[]
): void {
  if (visited.indexOf(startingProject) > -1) return;
  const reversedNode = reversed.nodes[startingProject];
  const reversedExternalNode = reversed.externalNodes[startingProject];
  if (!reversedNode && !reversedExternalNode) {
    throw new Error(`Invalid project name is detected: "${startingProject}"`);
  }
  visited.push(startingProject);
  if (reversedNode) {
    result.nodes[startingProject] = reversedNode;
    result.dependencies[startingProject] = [];
  } else {
    result.externalNodes[startingProject] = reversedExternalNode;
  }
  reversed.dependencies[startingProject]?.forEach(({ target }) =>
    addAffectedNodes(target, reversed, result, visited)
  );
}

function addAffectedDependencies(
  startingProject: string,
  reversed: ProjectGraph,
  result: ProjectGraph,
  visited: string[]
): void {
  if (visited.indexOf(startingProject) > -1) return;
  visited.push(startingProject);
  if (reversed.dependencies[startingProject]) {
    reversed.dependencies[startingProject].forEach(({ target }) =>
      addAffectedDependencies(target, reversed, result, visited)
    );
    reversed.dependencies[startingProject].forEach(
      ({ type, source, target }) => {
        // Since source and target was reversed,
        // we need to reverse it back to original direction.
        if (!result.dependencies[target]) {
          result.dependencies[target] = [];
        }
        result.dependencies[target].push({
          type,
          source: target,
          target: source,
        });
      }
    );
  }
}
