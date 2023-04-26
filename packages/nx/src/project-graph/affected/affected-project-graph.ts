import { FileChange, readPackageJson } from '../file-utils';
import {
  getImplicitlyTouchedProjects,
  getTouchedProjects,
} from './locators/workspace-projects';
import { getTouchedProjects as getJSTouchedProjects } from '../../plugins/js/project-graph/affected/touched-projects';
import {
  AffectedProjectGraphContext,
  TouchedProjectLocator,
} from './affected-project-graph-models';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { reverse } from '../operators';
import { readNxJson } from '../../config/configuration';
import { getTouchedProjectsFromProjectGlobChanges } from './locators/project-glob-changes';

export async function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: any = readPackageJson()
): Promise<ProjectGraph> {
  // Additional affected logic should be in this array.
  const touchedProjectLocators: TouchedProjectLocator[] = [
    getTouchedProjects,
    getImplicitlyTouchedProjects,
    getTouchedProjectsFromProjectGlobChanges,
    getJSTouchedProjects,
  ];

  const touchedProjects = [];
  for (const locator of touchedProjectLocators) {
    const projects = await locator(
      touchedFiles,
      graph.nodes,
      nxJson,
      packageJson,
      graph
    );
    touchedProjects.push(...projects);
  }

  return filterAffectedProjects(graph, {
    projectGraphNodes: graph.nodes,
    nxJson,
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
