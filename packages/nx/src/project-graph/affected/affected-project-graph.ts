import { FileChange, readPackageJson } from '../file-utils';
import { AffectedProjectGraphContext } from './affected-project-graph-models';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { reverse } from '../operators';
import { readNxJson } from '../../config/configuration';
import { runTouchedProjectLocators } from './affected-projects';
import type { AffectedReason } from './affected-reasons';

export interface AffectedProjectsWithReasons {
  graph: ProjectGraph;
  /** Every reason that applies, per project. Empty for none. */
  reasons: Record<string, AffectedReason[]>;
}

export async function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: any = readPackageJson(),
  projectDeletionAffectsAllProjects = true
): Promise<ProjectGraph> {
  return (
    await filterAffectedWithReasons(
      graph,
      touchedFiles,
      nxJson,
      packageJson,
      projectDeletionAffectsAllProjects
    )
  ).graph;
}

/**
 * The same filter, plus why each project is in it. `filterAffected` goes through
 * here so the two do not drift.
 *
 * Collecting costs one key construction and set lookup per traversed dependency
 * edge, not per project, and it is not gated on `--explain`, so every
 * `filterAffected` caller pays it. That includes `nx release`, which calls it
 * once per commit.
 */
export async function filterAffectedWithReasons(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: any = readPackageJson(),
  projectDeletionAffectsAllProjects = true
): Promise<AffectedProjectsWithReasons> {
  performance.mark('locateTouchedProjects:start');
  const touched = await runTouchedProjectLocators(
    graph,
    touchedFiles,
    nxJson,
    packageJson,
    projectDeletionAffectsAllProjects
  );
  performance.mark('locateTouchedProjects:end');
  performance.measure(
    'locateTouchedProjects',
    'locateTouchedProjects:start',
    'locateTouchedProjects:end'
  );

  const reasons: Record<string, AffectedReason[]> = {};
  // Deduped: two projects can be joined by several edges (a static import and
  // an implicit dependency, say), and the reverse walk visits each, which would
  // otherwise print the same line twice.
  const seen = new Set<string>();
  const record = (project: string, reason: AffectedReason) => {
    const key = `${project}\0${reason.kind}\0${reason.file ?? ''}\0${
      reason.package ?? ''
    }\0${reason.dependency ?? ''}\0${reason.pattern ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    (reasons[project] ??= []).push(reason);
  };
  for (const { project, ...reason } of touched) {
    record(project, reason);
  }

  // External nodes are reached by the walk and carry reasons of their own, but
  // they are not projects: listing them would inflate the count and print
  // npm:lodash@4.17.21 under a "projects" heading.
  return {
    graph: filterAffectedProjects(
      graph,
      {
        projectGraphNodes: graph.nodes,
        nxJson,
        touchedProjects: touched.map((t) => t.project),
      },
      record
    ),
    reasons: Object.fromEntries(
      Object.entries(reasons).filter(([name]) => !!graph.nodes[name])
    ),
  };
}

// -----------------------------------------------------------------------------

function filterAffectedProjects(
  graph: ProjectGraph,
  ctx: AffectedProjectGraphContext,
  record: (project: string, reason: AffectedReason) => void
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
    addAffectedNodes(p, reversed, result, visitedNodes, record);
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
  visited: Set<string>,
  record: (project: string, reason: AffectedReason) => void,
  /** The project this one was reached from, absent for a directly touched one. */
  reachedFrom?: string
): void {
  // Recorded before the visited check, so a project depending on several
  // affected projects reports each of them rather than only the first path in.
  // `record` dedupes, since a pair joined by more than one edge arrives here
  // once per edge.
  if (reachedFrom) {
    record(
      startingProject,
      reversed.externalNodes[reachedFrom]
        ? { kind: 'npm-package', package: reachedFrom }
        : { kind: 'dependency', dependency: reachedFrom }
    );
  }
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
    addAffectedNodes(target, reversed, result, visited, record, startingProject)
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
