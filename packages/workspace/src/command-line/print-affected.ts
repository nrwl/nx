import { ProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { Task } from '../tasks-runner/tasks-runner';
import { createTask } from '../tasks-runner/run-command';
import { basename } from 'path';
import { getCommand, getOutputs } from '../tasks-runner/utils';
import * as yargs from 'yargs';
import { NxArgs } from './utils';
import { cliCommand } from '@nrwl/workspace/src/core/file-utils';

export function printAffected(
  affectedProjectsWithTargetAndConfig: ProjectGraphNode[],
  affectedProjects: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  nxArgs: NxArgs,
  targetArgs: yargs.Arguments
) {
  const projectNames = affectedProjects.map(p => p.name);
  const tasksJson = createTasks(
    affectedProjectsWithTargetAndConfig,
    projectGraph,
    nxArgs,
    targetArgs
  );
  const result = {
    tasks: tasksJson,
    projects: projectNames,
    projectGraph: serializeProjectGraph(projectGraph)
  };
  console.log(JSON.stringify(selectPrintAffected(result, null), null, 2));
}

function createTasks(
  affectedProjectsWithTargetAndConfig: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  nxArgs: NxArgs,
  targetArgs: yargs.Arguments
) {
  const tasks: Task[] = affectedProjectsWithTargetAndConfig.map(
    affectedProject =>
      createTask({
        project: affectedProject,
        target: nxArgs.target,
        configuration: nxArgs.configuration,
        overrides: targetArgs
      })
  );
  const cli = cliCommand();
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  return tasks.map(task => ({
    id: task.id,
    overrides: targetArgs,
    target: task.target,
    command: `${isYarn ? 'yarn' : 'npm run'} ${getCommand(cli, isYarn, task)}`,
    outputs: getOutputs(projectGraph.nodes, task)
  }));
}

function serializeProjectGraph(projectGraph: ProjectGraph) {
  const nodes = Object.values(projectGraph.nodes).map(n => n.name);
  return { nodes, dependencies: projectGraph.dependencies };
}

function selectPrintAffected(result: any, select: string) {
  if (!select) return result;
  const parts = select.indexOf('.') > -1 ? select.split('.') : [select];
  return parts
    .reduce((m, c) => {
      if (m[c]) {
        return m[c];
      } else {
        throw new Error(
          `Cannot select '${select}' in the results of print-affected.`
        );
      }
    }, result)
    .join(', ');
}
