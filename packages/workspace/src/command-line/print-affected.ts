import { basename } from 'path';
import * as yargs from 'yargs';
import { cliCommand } from '../core/file-utils';
import { ProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { createTask } from '../tasks-runner/run-command';
import { Task } from '../tasks-runner/tasks-runner';
import { getCommandAsString, getOutputs } from '../tasks-runner/utils';
import { NxArgs } from './utils';

export async function printAffected(
  affectedProjectsWithTargetAndConfig: ProjectGraphNode[],
  affectedProjects: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  const projectNames = affectedProjects.map((p) => p.name);
  const tasksJson = await createTasks(
    affectedProjectsWithTargetAndConfig,
    projectGraph,
    nxArgs,
    overrides
  );
  const result = {
    tasks: tasksJson,
    projects: projectNames,
    projectGraph: serializeProjectGraph(projectGraph),
  };
  if (nxArgs.select) {
    console.log(selectPrintAffected(result, nxArgs.select));
  } else {
    console.log(JSON.stringify(selectPrintAffected(result, null), null, 2));
  }
}

async function createTasks(
  affectedProjectsWithTargetAndConfig: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  const tasks: Task[] = [];
  for (const affectedProject of affectedProjectsWithTargetAndConfig) {
    tasks.push(
      await createTask({
        project: affectedProject,
        target: nxArgs.target,
        configuration: nxArgs.configuration,
        overrides: overrides,
      })
    );
  }
  const cli = cliCommand();
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  return tasks.map((task) => ({
    id: task.id,
    overrides: overrides,
    target: task.target,
    command: `${isYarn ? 'yarn' : 'npm run'} ${getCommandAsString(
      cli,
      isYarn,
      task
    )}`,
    outputs: getOutputs(projectGraph.nodes, task),
  }));
}

function serializeProjectGraph(projectGraph: ProjectGraph) {
  const nodes = Object.values(projectGraph.nodes).map((n) => n.name);
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
        return first.map((q) => _select(q, rest)).join(', ');
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
