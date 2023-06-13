import { getCommandAsString, getOutputs } from '../../tasks-runner/utils';
import * as yargs from 'yargs';
import type { NxArgs } from '../../utils/command-line-utils';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import {
  createTaskGraph,
  mapTargetDefaultsToDependencies,
} from '../../tasks-runner/create-task-graph';
import { NxJsonConfiguration } from '../../config/nx-json';
import { Workspaces } from '../../config/workspaces';
import { InProcessTaskHasher } from '../../hasher/task-hasher';
import { hashTask } from '../../hasher/hash-task';
import { workspaceRoot } from '../../utils/workspace-root';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { fileHasher } from '../../hasher/file-hasher';
import { printAffectedDeprecationMessage } from './command-object';
import { logger, NX_PREFIX } from '../../utils/logger';

/**
 * @deprecated Use showProjectsHandler, generateGraph, or affected (without the print-affected mode) instead.
 */
export async function printAffected(
  affectedProjects: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  { nxJson }: { nxJson: NxJsonConfiguration },
  nxArgs: NxArgs,
  overrides: yargs.Arguments
) {
  logger.warn([NX_PREFIX, printAffectedDeprecationMessage].join(' '));
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
  const defaultDependencyConfigs = mapTargetDefaultsToDependencies(
    nxJson.targetDefaults
  );
  const taskGraph = createTaskGraph(
    projectGraph,
    defaultDependencyConfigs,
    affectedProjectsWithTargetAndConfig.map((p) => p.name),
    nxArgs.targets,
    nxArgs.configuration,
    overrides
  );
  const hasher = new InProcessTaskHasher(
    {},
    [],
    projectGraph,
    taskGraph,
    nxJson,
    {},
    fileHasher
  );
  const execCommand = getPackageManagerCommand().exec;
  const tasks = Object.values(taskGraph.tasks);

  await Promise.all(
    tasks.map((t) => hashTask(workspaces, hasher, projectGraph, {} as any, t))
  );

  return tasks.map((task) => ({
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
