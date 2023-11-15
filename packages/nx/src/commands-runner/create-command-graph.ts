import { ProjectGraph } from '../config/project-graph';
import { findCycle, makeAcyclic } from '../tasks-runner/task-graph-utils';
import { NxArgs } from '../utils/command-line-utils';
import { output } from '../utils/output';
import { CommandGraph } from './command-graph';

export function createCommandGraph(
  projectGraph: ProjectGraph,
  projectNames: string[],
  nxArgs: NxArgs
): CommandGraph {
  const dependencies: Record<string, string[]> = {};
  for (const projectName of projectNames) {
    if (projectGraph.dependencies[projectName].length >= 1) {
      dependencies[projectName] = [
        ...new Set(
          projectGraph.dependencies[projectName]
            .map((projectDep) => projectDep.target)
            .filter((projectDep) => projectGraph.nodes[projectDep])
        ).values(),
      ];
    } else {
      dependencies[projectName] = [];
    }
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
