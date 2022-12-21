import { getCommandAsString, getOutputs } from '../tasks-runner/utils';
import * as yargs from 'yargs';
import type { NxArgs } from '../utils/command-line-utils';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { Task } from '../config/task-graph';
import { ProcessTasks } from '../tasks-runner/create-task-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Workspaces } from '../config/workspaces';
import { Hasher } from '../hasher/hasher';
import { hashTask } from '../hasher/hash-task';
import { workspaceRoot } from '../utils/workspace-root';
import { getPackageManagerCommand } from '../utils/package-manager';

export async function printAffected(
  affectedProjects: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  { nxJson }: { nxJson: NxJsonConfiguration },
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  const projectsForType = affectedProjects.filter((p) =>
    nxArgs.type ? p.type === nxArgs.type : true
  );
  const projectNames = projectsForType.map((p) => p.name);
  const tasksJson =
    nxArgs.targets && nxArgs.targets.length > 0
      ? await createTasks(
          projectsForType,
          projectGraph,
          nxArgs,
          nxJson,
          overrides
        )
      : [];
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
  nxJson: NxJsonConfiguration,
  overrides: yargs.Arguments
) {
  const workspaces = new Workspaces(workspaceRoot);
  const hasher = new Hasher(projectGraph, nxJson, {});
  const execCommand = getPackageManagerCommand().exec;
  const p = new ProcessTasks({}, projectGraph);
  const tasks = [];
  for (let target of nxArgs.targets) {
    for (const affectedProject of affectedProjectsWithTargetAndConfig) {
      const resolvedConfiguration = p.resolveConfiguration(
        affectedProject,
        target,
        nxArgs.configuration
      );
      try {
        tasks.push(
          p.createTask(
            p.getId(affectedProject.name, target, resolvedConfiguration),
            affectedProject,
            target,
            resolvedConfiguration,
            overrides
          )
        );
      } catch (e) {}
    }
  }

  await Promise.all(
    tasks.map((t) => hashTask(workspaces, hasher, projectGraph, {} as any, t))
  );

  return tasks.map((task, index) => ({
    id: task.id,
    overrides,
    target: task.target,
    hash: task.hash,
    command: getCommandAsString(execCommand, task),
    outputs: getOutputs(projectGraph.nodes, task),
  }));
}

function serializeProjectGraph(projectGraph: ProjectGraph) {
  const nodes = Object.values(projectGraph.nodes).map((n) => n.name);
  const dependencies = {};
  // we don't need external dependencies' dependencies for print-affected
  // having them included makes the output unreadable
  Object.keys(projectGraph.dependencies).forEach((key) => {
    if (!key.startsWith('npm:')) {
      dependencies[key] = projectGraph.dependencies[key];
    }
  });
  return { nodes, dependencies };
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
