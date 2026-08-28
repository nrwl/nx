import { FileChange, readPackageJson } from '../file-utils';
import { getTouchedProjects as getJSTouchedProjects } from '../../plugins/js/project-graph/affected/touched-projects';
import { AffectedProjectGraphContext } from './affected-project-graph-models';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { reverse } from '../operators';
import { readNxJson } from '../../config/configuration';
import {
  ExternalObject,
  locateTouchedProjects,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../../native';
import { transformProjectGraphForRust } from '../../native/transform-objects';
import { workspaceRoot } from '../../utils/workspace-root';
import { getGlobPatternsOfPlugins } from '../utils/retrieve-workspace-files';
import { getPlugins } from '../plugins/get-plugins';

/**
 * `nx release` calls filterAffected once per commit with the same graph, so the
 * marshal has to be per-graph rather than per-call. Keyed by identity like
 * `reverse` in ../operators, but weak so a replaced graph is collectable.
 */
const marshalledGraphs = new WeakMap<
  ProjectGraph,
  ExternalObject<NativeProjectGraph>
>();

function marshalGraph(graph: ProjectGraph): ExternalObject<NativeProjectGraph> {
  let marshalled = marshalledGraphs.get(graph);
  if (!marshalled) {
    marshalled = transferProjectGraph(transformProjectGraphForRust(graph));
    marshalledGraphs.set(graph, marshalled);
  }
  return marshalled;
}

export async function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration = readNxJson(),
  packageJson: any = readPackageJson(),
  projectDeletionAffectsAllProjects = true
): Promise<ProjectGraph> {
  performance.mark('locateTouchedProjects:start');
  const touchedProjects = await locateTouchedProjects(
    marshalGraph(graph),
    nxJson,
    touchedFiles.map((f) => f.file),
    {
      projectGlobPatterns: await getProjectGlobPatterns(nxJson),
      projectDeletionAffectsAllProjects,
      workspaceRoot,
    },
    // Takes only paths, so the closure carries the FileChange objects: their
    // lazy getChanges() cannot cross the native boundary.
    [
      async () =>
        getJSTouchedProjects(
          touchedFiles,
          graph.nodes,
          nxJson,
          packageJson,
          graph,
          projectDeletionAffectsAllProjects
        ),
    ]
  );
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

/** Resolved here because `getPlugins` is async and starts plugin workers. */
async function getProjectGlobPatterns(
  nxJson: NxJsonConfiguration
): Promise<string[]> {
  // TODO: We need a quicker way to get patterns that should not
  // require starting up plugin workers
  if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
    return [
      '**/package.json',
      '**/project.json',
      'project.json',
      'package.json',
    ];
  }
  const plugins = (await getPlugins(nxJson)).filter((p) => !!p.createNodes);
  return getGlobPatternsOfPlugins(plugins);
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
