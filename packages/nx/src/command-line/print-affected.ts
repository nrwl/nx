import { getCommandAsString, getOutputs } from '../tasks-runner/utils';
import * as yargs from 'yargs';
import type { NxArgs } from '../utils/command-line-utils';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { Task } from '../config/task-graph';
import { Environment } from './read-environment';
import { ProcessTasks } from 'nx/src/tasks-runner/create-task-graph';

export async function printAffected(
  affectedProjectsWithTargetAndConfig: ProjectGraphProjectNode[],
  affectedProjects: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  { nxJson }: Environment,
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  const projectNames = affectedProjects
    .filter((p) => (nxArgs.type ? p.type === nxArgs.type : true))
    .map((p) => p.name);
  const tasksJson = await createTasks(
    affectedProjectsWithTargetAndConfig.filter((p) =>
      nxArgs.type ? p.type === nxArgs.type : true
    ),
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
  affectedProjectsWithTargetAndConfig: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  const tasks: Task[] = affectedProjectsWithTargetAndConfig.map(
    (affectedProject) => {
      const p = new ProcessTasks({}, projectGraph);
      const resolvedConfiguration = p.resolveConfiguration(
        affectedProject,
        nxArgs.target,
        nxArgs.configuration
      );
      return p.createTask(
        p.getId(affectedProject.name, nxArgs.target, resolvedConfiguration),
        affectedProject,
        nxArgs.target,
        resolvedConfiguration,
        overrides
      );
    }
  );

  return tasks.map((task, index) => ({
    id: task.id,
    overrides,
    target: task.target,
    command: getCommandAsString(task),
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
