import { FileChange, readPackageJson } from '../file-utils';
import { AffectedProjectGraphContext } from './affected-project-graph-models';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { reverse } from '../operators';
import { readNxJson } from '../../config/configuration';
import { runTouchedProjectLocators } from './affected-projects';

export async function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: any = readPackageJson(),
  projectDeletionAffectsAllProjects = true
): Promise<ProjectGraph> {
  performance.mark('locateTouchedProjects:start');
  const touchedProjects = (
    await runTouchedProjectLocators(
      graph,
      touchedFiles,
      nxJson,
      packageJson,
      projectDeletionAffectsAllProjects
    )
  ).map((t) => t.project);
  performance.mark('locateTouchedProjects:end');
  performance.measure(
    'locateTouchedProjects',
    'locateTouchedProjects:start',
    'locateTouchedProjects:end'
  );

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
  // Share visited Sets across all touched projects to avoid redundant traversal
  // Previously, each touched project got its own Set, causing shared dependencies
  // to be visited multiple times (O(touchedProjects × sharedDeps) → O(nodes))
  const visitedNodes = new Set<string>();
  const visitedDeps = new Set<string>();
  for (const p of ctx.touchedProjects) {
    addAffectedNodes(p, reversed, result, visitedNodes);
  }
  for (const p of ctx.touchedProjects) {
    addAffectedDependencies(p, reversed, result, visitedDeps);
  }
  return result;
}

function addAffectedNodes(
  startingProject: string,
  reversed: ProjectGraph,
  result: ProjectGraph,
  visited: Set<string>
): void {
  if (visited.has(startingProject)) return;
  const reversedNode = reversed.nodes[startingProject];
  const reversedExternalNode = reversed.externalNodes[startingProject];
  if (!reversedNode && !reversedExternalNode) {
    throw new Error(`Invalid project name is detected: "${startingProject}"`);
  }
  visited.add(startingProject);
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
  visited: Set<string>
): void {
  if (visited.has(startingProject)) return;
  visited.add(startingProject);
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
