import { ProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { Task } from '../tasks-runner/tasks-runner';
import { createTask } from '../tasks-runner/run-command';
import { basename } from 'path';
import { getCommandAsString, getOutputs } from '../tasks-runner/utils';
import * as yargs from 'yargs';
import { NxArgs } from './utils';
import { cliCommand } from '../core/file-utils';

export function printAffected(
  affectedProjectsWithTargetAndConfig: ProjectGraphNode[],
  affectedProjects: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  const projectNames = affectedProjects.map(p => p.name);
  const tasksJson = createTasks(
    affectedProjectsWithTargetAndConfig,
    projectGraph,
    nxArgs,
    overrides
  );
  const result = {
    tasks: tasksJson,
    projects: projectNames,
    projectGraph: serializeProjectGraph(projectGraph)
  };
  if (nxArgs.select) {
    console.log(selectPrintAffected(result, nxArgs.select));
  } else {
    console.log(JSON.stringify(selectPrintAffected(result, null), null, 2));
  }
}

function createTasks(
  affectedProjectsWithTargetAndConfig: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  const tasks: Task[] = affectedProjectsWithTargetAndConfig.map(
    affectedProject =>
      createTask({
        project: affectedProject,
        target: nxArgs.target,
        configuration: nxArgs.configuration,
        overrides: overrides
      })
  );
  const cli = cliCommand();
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  return tasks.map(task => ({
    id: task.id,
    overrides: overrides,
    target: task.target,
    command: `${isYarn ? 'yarn' : 'npm run'} ${getCommandAsString(
      cli,
      isYarn,
      task
    )}`,
    outputs: getOutputs(projectGraph.nodes, task)
  }));
}

function serializeProjectGraph(projectGraph: ProjectGraph) {
  const nodes = Object.values(projectGraph.nodes).map(n => n.name);
  return { nodes, dependencies: projectGraph.dependencies };
}

export function selectPrintAffected(wholeJson: any, wholeSelect: string) {
  if (!wholeSelect) return wholeJson;
  return _select(wholeJson, wholeSelect);

  function _select(json: any, select: string) {
    if (select.indexOf('.') > -1) {
      const [firstKey, ...restKeys] = select.split('.');
      const first = json[firstKey];
      throwIfEmpty(wholeSelect, first);
      const rest = restKeys.join('.');

      if (Array.isArray(first)) {
        return first.map(q => _select(q, rest)).join(', ');
      } else {
        return _select(first, rest);
      }
    } else {
      const res = json[select];
      throwIfEmpty(wholeSelect, res);
      if (Array.isArray(res)) {
        return res.join(', ');
      } else {
        return res;
      }
    }
  }
}

function throwIfEmpty(select: string, value: any) {
  if (value === undefined) {
    throw new Error(
      `Cannot select '${select}' in the results of print-affected.`
    );
  }
}
