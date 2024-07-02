import { ProjectGraph } from '../config/project-graph';
import { findCycle, makeAcyclic } from '../tasks-runner/task-graph-utils';
import { NxArgs } from '../utils/command-line-utils';
import { output } from '../utils/output';
import { CommandGraph } from './command-graph';

/**
 * Make structure { lib: [dep], dep: [dep1], dep1: [] } from projectName lib and projectGraph
 * @param projectGraph
 * @param projectName
 * @param resolved reference to an object that will contain resolved dependencies
 * @returns
 */
const recursiveResolveDeps = (
  projectGraph: ProjectGraph,
  projectName: string,
  resolved: Record<string, string[]>
) => {
  if (projectGraph.dependencies[projectName].length === 0) {
    // no deps - no resolve
    resolved[projectName] = [];
    return;
  }
  // if already resolved - just skip
  if (resolved[projectName]) {
    return resolved[projectName];
  }

  // deps string list
  const projectDeps = [
    ...new Set(
      projectGraph.dependencies[projectName]
        .map((projectDep) => projectDep.target)
        .filter((projectDep) => projectGraph.nodes[projectDep])
    ).values(),
  ];

  // define
  resolved[projectName] = projectDeps;
  if (projectDeps.length > 0) {
    for (const dep of projectDeps) {
      recursiveResolveDeps(projectGraph, dep, resolved);
    }
  }
};

export function createCommandGraph(
  projectGraph: ProjectGraph,
  projectNames: string[],
  nxArgs: NxArgs
): CommandGraph {
  const dependencies: Record<string, string[]> = {};
  for (const projectName of projectNames) {
    recursiveResolveDeps(projectGraph, projectName, dependencies);
  }
  const roots = Object.keys(dependencies).filter(
    (d) => dependencies[d].length === 0
  );
  const commandGraph = {
    dependencies,
    roots,
  };

  const cycle = findCycle(commandGraph);
  if (cycle) {
    if (process.env.NX_IGNORE_CYCLES === 'true' || nxArgs.nxIgnoreCycles) {
      output.warn({
        title: `The command graph has a circular dependency`,
        bodyLines: [`${cycle.join(' --> ')}`],
      });
      makeAcyclic(commandGraph);
    } else {
      output.error({
        title: `Could not execute command because the project graph has a circular dependency`,
        bodyLines: [`${cycle.join(' --> ')}`],
      });
      process.exit(1);
    }
  }

  return commandGraph;
}
